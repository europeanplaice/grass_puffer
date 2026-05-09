import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { resolve } from 'path'

function hashDistFiles(dir: string, root = dir): string {
  const hash = createHash('sha256')
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    const relativePath = path.slice(root.length + 1)

    if (entry.isDirectory()) {
      hash.update(`dir:${relativePath}\n`)
      hash.update(hashDistFiles(path, root))
      continue
    }

    if (!entry.isFile()) continue
    const { size } = statSync(path)
    hash.update(`file:${relativePath}:${size}\n`)
    hash.update(readFileSync(path))
  }

  return hash.digest('hex')
}

export default defineConfig({
  base: '/',
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
      '/auth': 'http://localhost:8788',
    },
  },
  plugins: [
    react(),
    {
      name: 'sw-cache-version-dev',
      apply: 'serve',
      buildStart() {
        const src = resolve(__dirname, 'public/sw.js')
        const distDir = resolve(__dirname, 'dist')
        if (!existsSync(distDir)) mkdirSync(distDir)
        const content = readFileSync(src, 'utf-8')
          .replace('__CACHE_VERSION__', `grass-puffer-dev-${Date.now()}`)
        writeFileSync(resolve(distDir, 'sw.js'), content)
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== '/sw.js') return next()
          const content = readFileSync(resolve(__dirname, 'public/sw.js'), 'utf-8')
            .replace('__CACHE_VERSION__', `grass-puffer-dev-${Date.now()}`)
          res.setHeader('Content-Type', 'application/javascript')
          res.end(content)
        })
      },
    },
    {
      name: 'csp-inline-hashes',
      apply: 'build',
      writeBundle() {
        const distPath = resolve(__dirname, 'dist')
        const html = readFileSync(resolve(distPath, 'index.html'), 'utf-8')
        const scriptRegex = /<script>([^<]+)<\/script>/g
        const hashes: string[] = []
        let match: RegExpExecArray | null
        while ((match = scriptRegex.exec(html)) !== null) {
          const hash = createHash('sha256').update(match[1]).digest('base64')
          hashes.push(`'sha256-${hash}'`)
        }
        const headersPath = resolve(distPath, '_headers')
        const updated = readFileSync(headersPath, 'utf-8')
          .replace('__INLINE_SCRIPT_HASHES__', hashes.join(' '))
        writeFileSync(headersPath, updated)
      },
    },
    {
      name: 'sw-cache-version',
      writeBundle() {
        const distPath = resolve(__dirname, 'dist')
        const swPath = resolve(__dirname, 'dist/sw.js')
        const version = hashDistFiles(distPath).slice(0, 16)
        const content = readFileSync(swPath, 'utf-8').replace(
          '__CACHE_VERSION__',
          `grass-puffer-${version}`,
        )
        writeFileSync(swPath, content)
      },
    },
  ],
})

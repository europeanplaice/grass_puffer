import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
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
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  plugins: [
    react(),
    {
      name: 'csp-production',
      apply: 'build',
      transformIndexHtml(html) {
        // Extract inline scripts (no src attribute)
        const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
        const hashes: string[] = []
        let match: RegExpExecArray | null
        while ((match = scriptRegex.exec(html)) !== null) {
          const content = match[1].trim()
          if (content) {
            const hash = createHash('sha256').update(content).digest('base64')
            hashes.push(`'sha256-${hash}'`)
          }
        }

        const cspContent = [
          "default-src 'self'",
          `script-src 'self' https://accounts.google.com ${hashes.join(' ')}`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob:",
          "worker-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "connect-src 'self' https://www.googleapis.com https://accounts.google.com https://oauth2.googleapis.com",
          "frame-src 'self' https://accounts.google.com",
          "form-action 'self'",
          "manifest-src 'self'",
        ].join('; ')

        return {
          html,
          tags: [{
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: cspContent,
            },
            injectTo: 'head-prepend',
          }],
        }
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

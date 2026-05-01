import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

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
      name: 'sw-cache-version',
      writeBundle() {
        const swPath = resolve(__dirname, 'dist/sw.js')
        const version = Date.now().toString(36)
        const content = readFileSync(swPath, 'utf-8').replace(
          '__CACHE_VERSION__',
          `grass-puffer-${version}`,
        )
        writeFileSync(swPath, content)
      },
    },
  ],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = '/grass_puffer/'

export default defineConfig({
  base,
  plugins: [
    {
      name: 'dev-public-asset-paths',
      transformIndexHtml(html, context) {
        if (!context.server) {
          return html
        }

        return html
          .replace(
            /href="\/grass_puffer(?:\/grass_puffer)+\/favicon\.svg"/g,
            'href="/grass_puffer/favicon.svg"',
          )
          .replace(
            /href="\/grass_puffer(?:\/grass_puffer)+\/manifest\.webmanifest"/g,
            'href="/grass_puffer/manifest.webmanifest"',
          )
          .replace(
            /href="\/grass_puffer(?:\/grass_puffer)+\/icon\.svg"/g,
            'href="/grass_puffer/icon.svg"',
          )
      },
    },
    react(),
  ],
})

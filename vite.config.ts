import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/_api-ecb': {
        target: 'https://data-api.ecb.europa.eu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/_api-ecb/, '/service')
      }
    }
  }
})

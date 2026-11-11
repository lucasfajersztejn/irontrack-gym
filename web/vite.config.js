import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      // El backend de IronTrack corre en 5000 (api/src/index.js:100). Proxy en
      // dev para evitar CORS y para que las cookies de Better Auth se traten
      // como mismo-origen.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})

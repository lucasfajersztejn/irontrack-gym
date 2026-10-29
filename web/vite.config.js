import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// vite-plugin-pwa se importa aquí pero se activa al final de Fase 1,
// cuando tengamos manifest + iconos definitivos. Dejarlo cableado desde
// ya evita retocar la config más adelante.
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // VitePWA({ registerType: 'autoUpdate', manifest: { /* TODO */ } }),
  ],
  server: {
    port: 5173,
    proxy: {
      // El backend de IronTrack corre en 3000. Proxy en dev para evitar CORS
      // y para que las cookies de Better Auth se traten como mismo-origen.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})

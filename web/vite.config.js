import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // autoUpdate: cuando se despliega una versión nueva, el SW la instala y
      // recarga solo (fuerza skipWaiting + clientsClaim). Para una app de una
      // sola persona es lo correcto: nadie quiere un botón "hay actualización".
      registerType: 'autoUpdate',
      // 'auto' inyecta el registro del service worker en el HTML; no hace falta
      // escribir el navigator.serviceWorker.register a mano.
      injectRegister: 'auto',
      // Assets sueltos (no emitidos por el bundle) que deben entrar al
      // precache para que el icono y el favicon estén disponibles offline.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'IronTrack — Registra tu entreno',
        short_name: 'IronTrack',
        description:
          'Registra tus entrenamientos, sigue tu progreso y mantén la racha.',
        lang: 'es',
        // theme_color debe coincidir con el <meta name="theme-color"> del
        // index.html, o algunos navegadores ignoran uno de los dos.
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // maskable: el launcher recorta el icono a círculo/squircle; esta
          // versión lleva más margen para que no se coma el rayo.
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Al navegar offline servimos el shell (index.html) y React resuelve la
        // ruta en cliente. Excluimos /api: una petición al backend nunca debe
        // caer en el HTML del shell, debe ir a la red (o fallar como API).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
      },
      // El SW no corre en `vite dev` para no ensuciar el ciclo de desarrollo
      // con caché; se prueba con `vite build` + `vite preview`.
      devOptions: { enabled: false },
    }),
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

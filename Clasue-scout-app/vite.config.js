import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
server: {
    proxy: { '/api': 'http://127.0.0.1:3001' },
    host: '0.0.0.0',
    allowedHosts: ['6390scout.tailc4582.ts.net']
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Scout · Hephaestus 6390',
        short_name: 'Scout',
        description: 'FRC Field Scouting Platform',
        theme_color: '#ba2732',
        background_color: '#141414',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [{
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: { cacheName:'scout-images', expiration:{maxEntries:80,maxAgeSeconds:2592000}, cacheableResponse:{statuses:[0,200]} }
        }]
      }
    })
  ]
})

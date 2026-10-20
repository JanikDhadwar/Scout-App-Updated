import { randomUUID } from 'node:crypto'
import process from 'node:process'
import packageInfo from './package.json' with { type: 'json' }
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const buildId=randomUUID()
const imageCache=`argus-images-${buildId}`
const releaseAssets={
  name:'argus-release-assets',
  generateBundle(){
    this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({version:packageInfo.version,buildId,revision:/^[a-f0-9]{40,64}$/.test(process.env.ARGUS_REVISION||'')?process.env.ARGUS_REVISION:null})})
    this.emitFile({type:'asset',fileName:'argus-cache-cleanup.js',source:`self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key==='scout-images'||key.startsWith('argus-images-')&&key!==${JSON.stringify(imageCache)}).map(key=>caches.delete(key))))));`})
  }
}

export default defineConfig({
server: {
    // Keep the browser's Host header so server.cjs can compare it with Origin.
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
    host: '0.0.0.0',
    allowedHosts: ['6390scout.tailc4582.ts.net']
  },
  plugins: [
    react(),
    releaseAssets,
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Argus Scouting',
        short_name: 'Argus',
        description: 'FRC Field Scouting Platform',
        theme_color: '#0b1018',
        background_color: '#0b1018',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        cacheId: `argus-${buildId}`,
        importScripts: ['/argus-cache-cleanup.js'],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [{
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'NetworkFirst',
          options: { cacheName:imageCache, networkTimeoutSeconds:4, expiration:{maxEntries:80,maxAgeSeconds:2592000}, cacheableResponse:{statuses:[0,200]} }
        }]
      }
    })
  ]
})

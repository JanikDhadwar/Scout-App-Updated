import { randomUUID } from 'node:crypto'
import process from 'node:process'
import packageInfo from './package.json' with { type: 'json' }
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const buildId=randomUUID()
const releaseAssets={
  name:'argus-release-assets',
  generateBundle(){
    this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({version:packageInfo.version,buildId,revision:/^[a-f0-9]{40,64}$/.test(process.env.ARGUS_REVISION||'')?process.env.ARGUS_REVISION:null})})
    // Remove the old account-independent image caches. Draft/queue media stays
    // in scoped IndexedDB; upgrades must never clear that device evidence.
    this.emitFile({type:'asset',fileName:'argus-cache-cleanup.js',source:`self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key==='scout-images'||key.startsWith('argus-images-')).map(key=>caches.delete(key))))));`})
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
          { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        cacheId: `argus-${buildId}`,
        importScripts: ['/argus-cache-cleanup.js','/argus-push.js'],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Only public files from this build are precached. Runtime image URLs
        // can contain private form/scouting content and must bypass shared SW
        // storage; the offline client owns account/workspace-scoped evidence.
        runtimeCaching: []
      }
    })
  ]
})

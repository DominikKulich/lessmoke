import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// DŮLEŽITÉ: base musí odpovídat názvu tvého GitHub repozitáře!
// Když repo bude github.com/DominikKulich/lessmoke, nech '/lessmoke/'
export default defineConfig({
  base: '/lessmoke/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Lessmoke',
        short_name: 'Lessmoke',
        description: 'Kuř míň, šetři víc. Pomocník s omezením kouření, přehledem výdajů a zdravotními milníky.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/lessmoke/',
        scope: '/lessmoke/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})

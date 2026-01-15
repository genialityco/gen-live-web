import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Permite conexiones desde cualquier host
    allowedHosts: [
      '.trycloudflare.com', // Cloudflare Tunnel
      '.ngrok.io',          // Ngrok
      '.ngrok-free.app',    // Ngrok gratis
      'localhost',
    ],
  },
})

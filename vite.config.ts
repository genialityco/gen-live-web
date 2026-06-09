import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
  ],
  server: {
    host: true,
    allowedHosts: [
      '.trycloudflare.com',
      '.ngrok.io',
      '.ngrok-free.app',
      'localhost',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/firebase/')) return 'vendor-firebase';
          if (id.includes('/livekit-client/') || id.includes('/@livekit/')) return 'vendor-livekit';
          if (id.includes('/@mantine/')) return 'vendor-mantine';
          if (id.includes('/@mui/') || id.includes('/@emotion/')) return 'vendor-mui';
          if (id.includes('/pdfjs-dist/') || id.includes('/react-pdf/')) return 'vendor-pdf';
          if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/d3/')) return 'vendor-charts';
          if (id.includes('/xlsx/')) return 'vendor-xlsx';
          if (id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/react/')) return 'vendor-react';
        },
      },
    },
  },
})

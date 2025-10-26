import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  optimizeDeps: {
    include: ['apify-client'],
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          'apify-vendor': ['apify-client'],
          'chart-vendor': ['recharts'],
        },
      },
    },
  },
})

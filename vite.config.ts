import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['apify-client', 'jspdf', 'html2canvas'],
  },
  build: {
    commonjsOptions: {
      include: [/jspdf/, /html2canvas/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          'apify-vendor': ['apify-client'],
          'chart-vendor': ['recharts'],
          'pdf-vendor': ['jspdf', 'html2canvas'],
        },
      },
    },
  },
})

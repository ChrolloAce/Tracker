import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    watch: {
      ignored: ['**/api/**'], // Ignore Vercel serverless functions
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  optimizeDeps: {
    include: ['apify-client'],
    exclude: ['api'],
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
    minify: 'esbuild',
  },
  // Remove all console logs in production builds
  esbuild: {
    drop: ['console', 'debugger'],
    pure: ['console.log', 'console.info', 'console.debug'],
  },
})

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
    allowedHosts: [
      'viewtrack.covenantstudios.dev',
      '.ngrok-free.app',   // free-tier ngrok subdomains
      '.ngrok.io',         // paid ngrok subdomains
      '.trycloudflare.com', // Cloudflare Tunnel quick tunnels
    ],
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
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
  // Remove all console logs in production builds only
  ...(process.env.NODE_ENV === 'production' ? {
    esbuild: {
      drop: ['console', 'debugger'],
      pure: ['console.log', 'console.info', 'console.debug'],
    },
  } : {}),
})

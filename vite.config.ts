import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      }
    }
  },
  optimizeDeps: {
    include: ['lamejs'],
    exclude: []
  },
  build: {
    commonjsOptions: {
      include: [/lamejs/, /node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        // Don't minify lamejs - it breaks internal references
        manualChunks: (id) => {
          if (id.includes('lamejs')) {
            return 'lamejs';
          }
        }
      }
    }
  }
})


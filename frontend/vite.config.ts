import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('@rainbow-me/rainbowkit')) {
              return 'vendor-rainbowkit';
            }
            if (id.includes('wagmi')) {
              return 'vendor-wagmi';
            }
            if (id.includes('viem')) {
              return 'vendor-viem';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('ethers')) {
              return 'vendor-ethers';
            }
            if (id.includes('reactflow')) {
              return 'vendor-graph';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        },
      },
    },
  },
})

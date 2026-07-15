import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// relative base: works when served from a subpath like username.github.io/tasker-living/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          qrcode: ['qrcode'],
        },
      },
    },
  },
})

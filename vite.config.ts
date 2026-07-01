import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// relative base: works when served from a subpath like username.github.io/tasker-living/
export default defineConfig({
  base: './',
  plugins: [react()],
})

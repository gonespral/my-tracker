import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the build works when hosted under a subpath
  // (GitHub Pages serves this app at /my-tracker/, not the domain root)
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
  },
})

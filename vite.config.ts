import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// relative base so the build works on GitHub Pages under /pacer/
export default defineConfig({
  base: './',
  plugins: [react()],
})

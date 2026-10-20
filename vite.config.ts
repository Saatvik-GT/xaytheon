import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: './', // relative paths so the build works on GitHub Pages or any sub-path
  optimizeDeps: { exclude: ['onnxruntime-web'] },
})

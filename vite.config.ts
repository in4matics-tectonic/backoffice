import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In dev, /v1 is proxied to the backend so the browser stays same-origin (no CORS, no API URL in the bundle).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: { '/v1': { target: env.BACKEND_URL || 'http://127.0.0.1:3000', changeOrigin: true } },
    },
  }
})

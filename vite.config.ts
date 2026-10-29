import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { devServer } from './vite/dev-server.js'

export default defineConfig(({ mode }) => {
  // The API code running inside the dev server needs the server-only variables in .env.local,
  // which Vite would otherwise hide (it only exposes VITE_* to the browser).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), devServer()],
    define: {
      __DEMO_MODE__: JSON.stringify(process.env.DEMO_MODE === 'true'),
    },
    build: {
      // Two entries: the public site (no Firebase, no staff code) and the staff/HQ app.
      rollupOptions: { input: { index: 'index.html', app: 'app.html' } },
    },
  }
})

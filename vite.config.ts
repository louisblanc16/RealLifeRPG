import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  server: { strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: {
    target: ['es2022', 'safari16.4'],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor'
          if (id.includes('/node_modules/dexie/')) return 'local-storage'
          if (id.includes('/node_modules/zod/')) return 'validation'
        },
      },
    },
  },
})

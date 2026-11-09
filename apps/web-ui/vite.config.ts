import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  // API_ is exposed alongside VITE_ so .env can hold API_URL without the Vite
  // prefix — the same name tera-server injects at runtime. Keep only public
  // values under API_*; they are inlined into the bundle like VITE_*.
  envPrefix: ['VITE_', 'API_'],
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})

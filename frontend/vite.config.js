import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, strictPort: true, proxy: { '/api': process.env.API_TARGET || 'http://127.0.0.1:8080', '/health': process.env.API_TARGET || 'http://127.0.0.1:8080' } },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'jsdom', include: ['src/**/__tests__/**/*.test.js'], restoreMocks: true },
})

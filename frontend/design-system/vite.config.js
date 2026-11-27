import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Standalone, offline design-system gallery. No proxy: every preview is driven by ./mock.
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: { host: '127.0.0.1', port: 5273, strictPort: true, open: false },
  preview: { host: '127.0.0.1', port: 5273, strictPort: true },
  build: { outDir: 'dist', sourcemap: false, emptyOutDir: true },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'], include: ['tests/**/*.test.js'], restoreMocks: true },
})

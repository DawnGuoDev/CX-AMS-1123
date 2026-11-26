import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// Standalone preview: relative base so the built package opens from any static path.
export default defineConfig({
  base: './',
  plugins: [vue(), {
    // The UMD OpenCC bundle is copied as-is; Vite's html script rewrite would break it.
    name: 'keep-umd-asset-script',
    apply: 'build',
    transformIndexHtml: html => html.replace('<script src="./vendor/opencc.js"></script>', '<script src="./vendor/opencc.js"><\/script>'),
  }],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', sourcemap: false },
})

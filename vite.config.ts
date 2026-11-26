import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': '/src' },
  },
  // The game, and a test page for the Trommelhaus's sound and microphone (src/debug/trommelDebug.ts): in the build,
  // because the iPad only gives the microphone to an https page
  build: {
    rollupOptions: { input: { index: 'index.html', trommel: 'debug/trommel.html' } },
  },
  // The game's server (backend/, scripts/dev.sh starts both)
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})

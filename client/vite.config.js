import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Codespaces serves forwarded ports on *.app.github.dev; Vite blocks unknown Host headers.
    allowedHosts: ['.app.github.dev'],
    // The inspector API (private). The public capture port (3001) is never proxied.
    proxy: {
      '/api': 'http://127.0.0.1:3002',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    restoreMocks: true,
  },
});

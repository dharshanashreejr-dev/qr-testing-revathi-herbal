import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: vite on :5173, mock API on :3001 (proxied). Phone testing needs HTTPS -> use `npm run demo` + ngrok on :3001.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, allowedHosts: true, proxy: { '/api': 'http://localhost:3001' } },
});

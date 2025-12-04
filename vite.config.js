import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Serve the built site at the repository root. Routes that include `/app/*`
  // (e.g. `/app/login`) are handled by the client router, so the server
  // must return the SPA `index.html` for those paths. Keep base `/` so
  // assets are referenced from the root.
  base: '/',
  // Use default outDir (dist) so Render can publish the `dist` directory.
  build: {
    outDir: 'dist',
  },
  plugins: [react()],
  server: {
    port: 4173,
  },
});

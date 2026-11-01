import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { hmr: process.env.DISABLE_HMR !== 'true' },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'buffer': 'buffer/',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    include: ['buffer'],
  },
  build: {
    outDir: "build-react",
    rollupOptions: {
      external: ['buffer'],
      output: {
        globals: {
          buffer: 'Buffer',
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  define: {
    'process.env': {},
    'global': 'globalThis',
  },
});

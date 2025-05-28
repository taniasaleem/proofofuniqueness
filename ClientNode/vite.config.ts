import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'buffer': 'buffer',
      'process': 'process/browser',
      'stream': 'stream-browserify',
      'util': 'util',
      'crypto': 'crypto-browserify'
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    include: ['buffer', 'process', 'util', 'stream', 'crypto'],
    exclude: ['electron']
  },
  base: "./",
  build: {
    outDir: "build-react",
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'es',
      },
    },
  },
  server: {
    port: 3001,
    strictPort: false,
  },
  define: {
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'global': 'globalThis',
  },
});

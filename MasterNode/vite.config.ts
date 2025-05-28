import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",
  optimizeDeps: {
    exclude: [
      'libp2p',
      'libp2p-mdns',
      '@libp2p/mdns',
      '@libp2p/peer-id',
      '@libp2p/peer-id-factory',
      '@libp2p/interface',
      '@libp2p/tcp',
      '@libp2p/websockets',
      '@chainsafe/libp2p-noise',
      '@chainsafe/libp2p-yamux',
      'thunky',
      'multicast-dns'
    ]
  },
  build: {
    outDir: "build-react",
    rollupOptions: {
      external: [
        'libp2p',
        'libp2p-mdns',
        '@libp2p/mdns',
        '@libp2p/peer-id',
        '@libp2p/peer-id-factory',
        '@libp2p/interface',
        '@libp2p/tcp',
        '@libp2p/websockets',
        '@chainsafe/libp2p-noise',
        '@chainsafe/libp2p-yamux',
        'thunky',
        'multicast-dns'
      ]
    }
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});

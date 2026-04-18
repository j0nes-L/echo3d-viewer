import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://j0nes-l.github.io',
  base: '/echo3d-viewer',
  output: 'static',
  vite: {
    server: {
      proxy: {
        '/api-proxy': {
          target: 'https://api.00224466.xyz/echo3d',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-proxy/, ''),
        },
      },
    },
  },
});
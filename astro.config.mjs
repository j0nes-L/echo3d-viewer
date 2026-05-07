import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://j0nes-l.github.io',
  base: '/snapspace-viewer',
  output: 'static',
  vite: {
    server: {
      proxy: {
        '/api-proxy': {
          target: 'https://api-gateway-00224466.ludorfjonas.workers.dev',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api-proxy/, '/snapspace'),
        },
      },
    },
  },
});

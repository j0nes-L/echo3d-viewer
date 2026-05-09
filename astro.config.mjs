import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://snapspace.jonasludorf.dev',
  base: '/',
  output: 'server',
  adapter: vercel(),
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

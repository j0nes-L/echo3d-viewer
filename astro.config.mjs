import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://snapspace.jonasludorf.dev',
  base: '/',
  output: 'server',
  adapter: vercel({
    imageService: false,
  }),
  server: {
    host: 'localhost',
    port: 4321,
  },
});

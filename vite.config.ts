import { defineConfig } from 'vite';

// GitHub Pages serves the site from /pip-personality-bot/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/pip-personality-bot/' : '/',
  build: { target: 'es2022' },
});

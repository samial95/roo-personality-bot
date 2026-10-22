import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo-name>/ (taken from the Actions environment)
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: repo ? `/${repo}/` : '/',
  build: { target: 'es2022' },
});

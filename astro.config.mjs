import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mmichaelush.github.io',
  base: process.env.MYOTO_BASE ?? '/MyOto',
  trailingSlash: 'always',
  output: 'static',
  devToolbar: { enabled: false },
  build: { concurrency: 6, inlineStylesheets: 'never' },
});

// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Standard: eigene Domain. Die GitHub-Pages-Vorschau setzt SITE_URL und BASE_PATH (siehe scripts/deploy-preview.sh).
  site: process.env.SITE_URL || 'https://www.fliesen-dierken.de',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  // CSS inline: keine render-blockierenden Stylesheet-Requests
  build: { format: 'directory', inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});

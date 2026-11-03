// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.fliesen-dierken.de',
  trailingSlash: 'ignore',
  // CSS inline: keine render-blockierenden Stylesheet-Requests
  build: { format: 'directory', inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});

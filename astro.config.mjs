// The demo site of the generator: one static page per language (/, /nl/, /es/). `npm run build` writes it to dist/.
import { defineConfig } from 'astro/config';

export default defineConfig({
  devToolbar: { enabled: false },
  build: { format: 'directory' },
});

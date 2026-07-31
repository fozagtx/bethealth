import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

export default defineConfig({
  integrations: [react(), tailwind()],
  adapter: vercel(),
  // No cookies, sessions, or server-side state exist — the extract endpoint is a
  // stateless proxy — so origin checking adds nothing and misfires behind
  // Vercel's proxy (403 on same-origin form POSTs).
  security: { checkOrigin: false },
});

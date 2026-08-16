import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

export default defineConfig({
  integrations: [react(), tailwind()],
  adapter: vercel(),
  // Extract is a stateless proxy (no cookies/sessions/server state).
  // Origin checks add nothing here and can 403 behind Vercel's proxy on same-origin POSTs.
  security: { checkOrigin: false },
});

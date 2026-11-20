import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Use generic Convex references only inside tests; real deployments run codegen.
export default defineConfig({
  plugins: [{
    name: 'test-convex-references',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === './_generated/api' && importer?.includes('/convex/')) {
        return fileURLToPath(new URL('./test/api.js', import.meta.url));
      }
    },
  }],
  test: {
    include: ['test/**/*.test.js'],
    server: { deps: { inline: ['@convex-dev/better-auth', '@convex-dev/static-hosting'] } },
    env: {
      CONVEX_SITE_URL: 'https://auth-test.convex.site',
      SITE_URL: 'https://auth-test.convex.site',
      BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
      // Fixtures create accounts through the real sign-up route; production keeps it closed.
      AUTH_SIGNUP_ENABLED: 'true',
    },
  },
});

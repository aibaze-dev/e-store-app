import { defineApp } from 'convex/server';
import staticHosting from '@convex-dev/static-hosting/convex.config';
import betterAuth from '@convex-dev/better-auth/convex.config';

// Own the router so /api/auth is not prefixed a second time by the hosting mount.
const app = defineApp();
app.use(betterAuth);
app.use(staticHosting);
export default app;

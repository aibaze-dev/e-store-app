import { httpRouter } from 'convex/server';
import { registerStaticRoutes } from '@convex-dev/static-hosting';
import { components } from './_generated/api';
import { authComponent, createAuth } from './auth';

const http = httpRouter();
authComponent.registerRoutes(http, createAuth, { cors: true });
// Register additional HTTP actions explicitly under /api before this catch-all.
registerStaticRoutes(http, components.staticHosting);
export default http;

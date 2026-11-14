import { betterAuth } from 'better-auth/minimal';
import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
import { queryGeneric, type GenericDataModel } from 'convex/server';
import { components } from './_generated/api';
import authConfig from './auth.config';
import { authOrigins } from './lib/auth_origins';

export const authComponent = createClient(components.betterAuth);

export function createAuth(ctx: GenericCtx<GenericDataModel>) {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    database: authComponent.adapter(ctx),
    trustedOrigins: () => authOrigins(process.env),
    session: { cookieCache: { enabled: false } },
    emailAndPassword: { enabled: true, requireEmailVerification: false, minPasswordLength: 8 },
    plugins: [crossDomain({ siteUrl: process.env.SITE_URL! }), convex({ authConfig })],
  });
}

// Use this in each private query/mutation, then check ownership/roles server-side.
// Signing up never grants an application role or administrator privileges.
export const requireUser = (ctx: GenericCtx<GenericDataModel>) => authComponent.getAuthUser(ctx);

export const getCurrentUser = queryGeneric({
  args: {},
  handler: async ctx => {
    const user = await requireUser(ctx);
    return { id: user._id, name: user.name, email: user.email };
  },
});

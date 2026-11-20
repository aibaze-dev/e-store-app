import { betterAuth } from 'better-auth/minimal';
import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
import { queryGeneric, type GenericDataModel } from 'convex/server';
import { components } from './_generated/api';
import authConfig from './auth.config';
import { authOrigins } from './lib/auth_origins';
import { isAdminEmail } from './lib/admin_emails';
import { adminIpAllowed } from './lib/admin_ip';
import { clientIp } from './lib/request_ip';
import { APIError, createAuthMiddleware } from 'better-auth/api';

export const authComponent = createClient(components.betterAuth);

export function createAuth(ctx: GenericCtx<GenericDataModel>) {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    database: authComponent.adapter(ctx),
    trustedOrigins: () => authOrigins(process.env),
    session: { cookieCache: { enabled: false } },
    // Sign-up is closed: the only account is the internal admin. Set AUTH_SIGNUP_ENABLED=true in
    // Convex only while creating a new account, then remove it.
    emailAndPassword: {
      enabled: true,
      disableSignUp: process.env.AUTH_SIGNUP_ENABLED !== 'true',
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    plugins: [crossDomain({ siteUrl: process.env.SITE_URL! }), convex({ authConfig })],
    // Sign-in and sign-up answer 404 outside ADMIN_ALLOWED_IPS, as if the route did not exist.
    // Sessions already open keep working from anywhere.
    hooks: {
      before: createAuthMiddleware(async request => {
        if (!/^\/sign-(in|up)\//.test(request.path)) return;
        if (!(await adminIpAllowed(ctx))) {
          console.warn(`Sign-in blocked for IP ${await clientIp(ctx)}`);
          throw new APIError('NOT_FOUND');
        }
      }),
    },
  });
}

// Use this in each private query/mutation, then check ownership/roles server-side.
// Signing up never grants an application role or administrator privileges.
export const requireUser = (ctx: GenericCtx<GenericDataModel>) => authComponent.getAuthUser(ctx);

export const getCurrentUser = queryGeneric({
  args: {},
  handler: async ctx => {
    const user = await requireUser(ctx);
    return { id: user._id, name: user.name, email: user.email, isAdmin: isAdminEmail(user.email) };
  },
});

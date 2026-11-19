import { describe, it, expect, vi, afterEach } from 'vitest';
import { convexTest } from 'convex-test';
import betterAuth from '@convex-dev/better-auth/test';
import staticHosting from '@convex-dev/static-hosting/test';
import schema from '../convex/schema';
import { api } from './api';
import { authOrigins } from '../convex/lib/auth_origins';

const modules = { ...import.meta.glob('../convex/**/*.ts'), '../convex/_generated/api.js': () => import('./api') };
const origin = 'https://auth-test.convex.site';
const credentials = { email: 'member@example.com', password: 'Strong-passphrase-123' };
afterEach(() => vi.unstubAllEnvs());
function backend() {
  const t = convexTest(schema, modules);
  betterAuth.register(t);
  staticHosting.register(t);
  return t;
}
function post(t, endpoint, body, extra = {}) {
  return t.fetch(`/api/auth/${endpoint}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'Better-Auth-Cookie': '', 'Sec-Fetch-Site': 'cross-site', ...extra }, body: JSON.stringify(body) });
}

describe('project authentication', () => {
  it('registers, logs in, reads the session and invalidates it on logout through HTTP', async () => {
    const t = backend();
    const signup = await post(t, 'sign-up/email', { ...credentials, name: 'Member' });
    expect(signup.status).toBe(200);
    const account = await signup.json();
    expect(account.user.email).toBe(credentials.email);
    const login = await post(t, 'sign-in/email', credentials);
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-better-auth-cookie');
    expect(cookie).toContain('session_token=');
    // Better Auth's cross-domain plugin uses this header instead of browser cookies.
    const token = cookie.match(/(?:^|,\s*)([^=;,]*session_token)=([^;]+)/);
    expect(token).not.toBeNull();
    const headers = { Origin: origin, 'Better-Auth-Cookie': `${token[1]}=${decodeURIComponent(token[2])}` };
    const session = await t.fetch('/api/auth/get-session', { headers });
    expect((await session.json()).user.email).toBe(credentials.email);
    const jwt = await t.fetch('/api/auth/convex/token', { headers });
    expect(jwt.status).toBe(200);
    const claims = JSON.parse(Buffer.from((await jwt.json()).token.split('.')[1], 'base64url').toString());
    const authenticated = t.withIdentity({ subject: claims.sub, sessionId: claims.sessionId });
    expect((await authenticated.query(api.auth.getCurrentUser, {})).email).toBe(credentials.email);
    expect((await post(t, 'sign-out', {}, headers)).status).toBe(200);
    expect(await (await t.fetch('/api/auth/get-session', { headers })).json()).toBeNull();
    const loggedOutToken = await t.fetch('/api/auth/convex/token', { headers });
    expect(loggedOutToken.status).toBe(401);
    expect(await loggedOutToken.json()).not.toHaveProperty('token');
    await expect(authenticated.query(api.auth.getCurrentUser, {})).rejects.toThrow();
  });

  it('rejects Convex token requests without a session', async () => {
    const t = backend();
    const response = await t.fetch('/api/auth/convex/token', {
      headers: { Origin: origin, 'Better-Auth-Cookie': '' },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty('token');
  });

  it('rejects anonymous private queries, wrong passwords and untrusted signups', async () => {
    const t = backend();
    await expect(t.query(api.auth.getCurrentUser, {})).rejects.toThrow();
    await post(t, 'sign-up/email', { ...credentials, name: 'Member' });
    expect((await post(t, 'sign-in/email', { ...credentials, password: 'wrong-password' })).status).toBe(401);
    expect((await post(t, 'sign-up/email', { ...credentials, email: 'other@example.com', name: 'Other' }, { Origin: 'https://unrelated.convex.site' })).status).toBe(403);
  });

  it('trusts only the exact active preview and expires that trust', () => {
    const env = { SITE_URL: origin, ATENEO_AUTH_PREVIEW_ORIGIN: 'https://preview.vercel.run', ATENEO_AUTH_PREVIEW_EXPIRES_AT: String(Date.now() + 60000) };
    expect(authOrigins(env)).toContain(env.ATENEO_AUTH_PREVIEW_ORIGIN);
    expect(authOrigins(env)).not.toContain('https://other.vercel.run');
    expect(authOrigins({ ...env, ATENEO_AUTH_PREVIEW_EXPIRES_AT: '1' })).not.toContain(env.ATENEO_AUTH_PREVIEW_ORIGIN);
    expect(() => authOrigins({ SITE_URL: 'https://example.com/path' })).toThrow();
  });

  it('allows browser preflight/login from the active preview and rejects it after expiry', async () => {
    const preview = 'https://preview.vercel.run';
    vi.stubEnv('ATENEO_AUTH_PREVIEW_ORIGIN', preview);
    vi.stubEnv('ATENEO_AUTH_PREVIEW_EXPIRES_AT', String(Date.now() + 60000));
    const t = backend();
    const preflight = () => t.fetch('/api/auth/sign-in/email', { method: 'OPTIONS', headers: {
      Origin: preview, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,better-auth-cookie',
    } });
    expect((await preflight()).headers.get('access-control-allow-origin')).toBe(preview);
    const signup = await post(t, 'sign-up/email', { ...credentials, name: 'Preview user' }, { Origin: preview });
    expect(signup.status).toBe(200);
    expect(signup.headers.get('access-control-allow-origin')).toBe(preview);
    vi.stubEnv('ATENEO_AUTH_PREVIEW_EXPIRES_AT', '1');
    expect((await preflight()).headers.get('access-control-allow-origin')).not.toBe(preview);
    expect((await post(t, 'sign-in/email', credentials, { Origin: preview })).status).toBe(403);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { convexTest } from 'convex-test';
import betterAuth from '@convex-dev/better-auth/test';
import staticHosting from '@convex-dev/static-hosting/test';
import schema from '../convex/schema';
import { api } from './api';
import { isAdminIpAllowed } from '../convex/lib/admin_ip';
import { clientIp } from '../convex/lib/request_ip';

// convex-test does not implement the native getRequestMetadata syscall; only the transport
// IP is replaced, the rule matching, the auth hook and the action run for real.
vi.mock('../convex/lib/request_ip', () => ({ clientIp: vi.fn(async () => null) }));

const modules = { ...import.meta.glob('../convex/**/*.ts'), '../convex/_generated/api.js': () => import('./api') };
const origin = 'https://auth-test.convex.site';
const credentials = { email: 'admin@example.com', password: 'Strong-passphrase-123' };
const rules = '198.51.100.7,2001:db8:7c:3601::/64';
afterEach(() => { vi.unstubAllEnvs(); clientIp.mockResolvedValue(null); });

function backend() {
  const t = convexTest(schema, modules);
  betterAuth.register(t);
  staticHosting.register(t);
  return t;
}
const post = (t, endpoint, body) => t.fetch(`/api/auth/${endpoint}`, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin, 'Better-Auth-Cookie': '', 'Sec-Fetch-Site': 'cross-site' }, body: JSON.stringify(body) });

describe('admin IP allowlist', () => {
  it('matches exact IPv4 addresses and IPv6 ranges, including rotating temporary addresses', () => {
    expect(isAdminIpAllowed('198.51.100.7', rules)).toBe(true);
    expect(isAdminIpAllowed('::ffff:198.51.100.7', rules)).toBe(true);
    expect(isAdminIpAllowed('198.51.100.8', rules)).toBe(false);
    expect(isAdminIpAllowed('2001:db8:7c:3601:ca4:cf58:a7ab:d904', rules)).toBe(true);
    expect(isAdminIpAllowed('2001:DB8:7C:3601:9922:91b7:164:1aa3', rules)).toBe(true);
    expect(isAdminIpAllowed('2001:db8:7c:3602::1', rules)).toBe(false);
    expect(isAdminIpAllowed('10.0.0.0', '10.0.0.0/8')).toBe(true);
    expect(isAdminIpAllowed('11.0.0.0', '10.0.0.0/8')).toBe(false);
    expect(isAdminIpAllowed(null, rules)).toBe(false);
    expect(isAdminIpAllowed('not-an-ip', rules)).toBe(false);
    expect(isAdminIpAllowed('198.51.100.7', 'garbage,1.2.3.4/99')).toBe(false);
  });

  it('applies no restriction while ADMIN_ALLOWED_IPS is unset', async () => {
    expect(isAdminIpAllowed(null, '')).toBe(true);
    expect(await backend().action(api.access.check, {})).toBe(true);
  });

  it('shows the login only to allowed IPs', async () => {
    vi.stubEnv('ADMIN_ALLOWED_IPS', rules);
    const t = backend();
    clientIp.mockResolvedValue('203.0.113.50');
    expect(await t.action(api.access.check, {})).toBe(false);
    clientIp.mockResolvedValue('2001:db8:7c:3601:5b:a3e:6e2f:2164');
    expect(await t.action(api.access.check, {})).toBe(true);
  });

  it('answers 404 to sign-in and sign-up from other IPs, even with the right password', async () => {
    const t = backend();
    expect((await post(t, 'sign-up/email', { ...credentials, name: 'Admin' })).status).toBe(200);
    vi.stubEnv('ADMIN_ALLOWED_IPS', rules);
    clientIp.mockResolvedValue('203.0.113.50');
    expect((await post(t, 'sign-in/email', credentials)).status).toBe(404);
    expect((await post(t, 'sign-up/email', { ...credentials, email: 'other@example.com', name: 'Other' })).status).toBe(404);
    clientIp.mockResolvedValue('198.51.100.7');
    expect((await post(t, 'sign-in/email', credentials)).status).toBe(200);
  });
});

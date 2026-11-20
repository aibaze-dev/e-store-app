import { normalizeIp } from './analytics_ip';
import { clientIp } from './request_ip';

// ADMIN_ALLOWED_IPS (Convex env): comma-separated IPs or CIDR ranges, IPv4 or IPv6, e.g.
// "203.0.113.7,2001:db8:1:2::/64". Only those addresses see the login and can sign in.
// Unset or empty means no restriction, so a missing variable never locks the admin out.
export function adminIpRules(list = process.env.ADMIN_ALLOWED_IPS) {
  return (list || '').split(',').map(rule => rule.trim()).filter(Boolean);
}

function toBits(ip: string | null) {
  if (!ip) return null;
  if (!ip.includes(':')) return ip.split('.').map(octet => Number(octet).toString(2).padStart(8, '0')).join('');
  const [head, tail] = ip.split('::');
  const start = head ? head.split(':') : [];
  const end = tail ? tail.split(':') : [];
  const groups = tail === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill('0'), ...end];
  if (groups.length !== 8) return null;
  return groups.map(group => parseInt(group, 16).toString(2).padStart(16, '0')).join('');
}

export function isAdminIpAllowed(ip: string | null, list = process.env.ADMIN_ALLOWED_IPS) {
  const rules = adminIpRules(list);
  if (rules.length === 0) return true;
  const address = toBits(normalizeIp(ip));
  if (!address) return false;
  return rules.some(rule => {
    const [base, prefix] = rule.split('/');
    const range = toBits(normalizeIp(base));
    if (!range || range.length !== address.length) return false;
    const length = prefix === undefined ? range.length : Number(prefix);
    if (!Number.isInteger(length) || length < 0 || length > range.length) return false;
    return address.slice(0, length) === range.slice(0, length);
  });
}

export async function adminIpAllowed(ctx: any) {
  if (adminIpRules().length === 0) return true;
  return isAdminIpAllowed(await clientIp(ctx));
}

import type { MutationCtx } from './functions';

// Native transport metadata, never an IP or forwarded header supplied in args.
export async function requestIp(ctx: MutationCtx) {
  return (await ctx.meta.getRequestMetadata()).ip;
}

export function normalizeIp(ip: string | null) {
  if (!ip) return null;
  const value = ip.trim().toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    const octets = value.split('.').map(Number);
    return octets.every(part => part <= 255) ? octets.join('.') : null;
  }
  if (!value.includes(':') || /[^0-9a-f:.]/.test(value)) return null;
  try {
    const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
    // IPv4-mapped IPv6 and the corresponding IPv4 address share one identity.
    const mapped = normalized.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
    if (mapped) {
      const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
      return [high >> 8, high & 255, low >> 8, low & 255].join('.');
    }
    return normalized;
  } catch { return null; }
}

export async function hashIp(ip: string | null, storeId: string, secret: string) {
  const normalized = normalizeIp(ip);
  if (!normalized) return undefined;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`store-analytics:v1:${storeId}:${normalized}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

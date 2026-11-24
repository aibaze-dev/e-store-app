import { ConvexError } from 'convex/values';
import { isSupportedCurrency } from '../../shared/currencies.js';

export function fail(message: string): never {
  throw new ConvexError(message);
}

export function cleanText(value: string, label: string, max: number, required = false) {
  const text = value.trim();
  if (required && !text) fail(`${label}: completá este campo.`);
  if (text.length > max) fail(`${label}: usá hasta ${max} caracteres.`);
  return text;
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function cleanUrl(value: string, label: string, required = false) {
  const text = value.trim();
  if (!text) {
    if (required) fail(`${label}: ingresá un link.`);
    return '';
  }
  if (text.length > 2000 || !isHttpUrl(text)) fail(`${label}: ingresá un link válido que empiece con https://.`);
  return text;
}

// Amounts are integers in the currency's minor unit.
export function cleanAmount(value: number, label: string, min = 1) {
  if (!Number.isInteger(value) || value < min || value > 99_999_999) fail(`${label}: ingresá un importe válido.`);
  return value;
}

// Downsell discounts are whole percentages; 0 is only valid while the downsell is off.
export function cleanPercent(value: number, label: string, min = 1) {
  if (!Number.isInteger(value) || value < min || value > 90) fail(`${label}: ingresá un porcentaje entero entre 1 y 90.`);
  return value;
}

export function cleanCurrency(value: string) {
  const code = value.trim().toUpperCase();
  if (!isSupportedCurrency(code)) fail('Moneda: elegí una de las monedas de la lista.');
  return code;
}

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'panel', 'l', 'admin', 'app']);

export function cleanSubdomain(value: string) {
  const subdomain = value.trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
    fail('Subdominio: usá solo minúsculas, números y guiones, sin empezar ni terminar con guion.');
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) fail('Subdominio: ese nombre está reservado. Elegí otro.');
  return subdomain;
}

// Currencies a store can charge in, all accepted by Stripe Checkout.
// `digits` is how many decimals Stripe counts for the currency: prices are stored as
// integers in that minor unit and sent to Stripe as they are. It is set here, not read from
// Intl, because they can disagree (Intl gives COP 0 decimals, Stripe charges it with 2).
// `locale` is how buyers of that currency write prices. Check both before adding a currency.
export const CURRENCIES = [
  { code: 'USD', name: 'Dólar estadounidense', digits: 2, locale: 'en-US' },
  { code: 'EUR', name: 'Euro', digits: 2, locale: 'es-ES' },
  { code: 'GBP', name: 'Libra esterlina', digits: 2, locale: 'en-GB' },
  { code: 'CAD', name: 'Dólar canadiense', digits: 2, locale: 'en-CA' },
  { code: 'AUD', name: 'Dólar australiano', digits: 2, locale: 'en-AU' },
  { code: 'MXN', name: 'Peso mexicano', digits: 2, locale: 'es-MX' },
  { code: 'ARS', name: 'Peso argentino', digits: 2, locale: 'es-AR' },
  { code: 'BRL', name: 'Real brasileño', digits: 2, locale: 'pt-BR' },
  { code: 'CLP', name: 'Peso chileno', digits: 0, locale: 'es-CL' },
  { code: 'COP', name: 'Peso colombiano', digits: 2, locale: 'es-CO' },
  { code: 'PEN', name: 'Sol peruano', digits: 2, locale: 'es-PE' },
  { code: 'UYU', name: 'Peso uruguayo', digits: 2, locale: 'es-UY' },
  { code: 'PYG', name: 'Guaraní paraguayo', digits: 0, locale: 'es-PY' },
  { code: 'BOB', name: 'Boliviano', digits: 2, locale: 'es-BO' },
  { code: 'CRC', name: 'Colón costarricense', digits: 2, locale: 'es-CR' },
  { code: 'DOP', name: 'Peso dominicano', digits: 2, locale: 'es-DO' },
  { code: 'GTQ', name: 'Quetzal guatemalteco', digits: 2, locale: 'es-GT' },
];

const BY_CODE = new Map(CURRENCIES.map(currency => [currency.code, currency]));
const find = code => BY_CODE.get(String(code ?? '').trim().toUpperCase());

export function isSupportedCurrency(code) {
  return Boolean(find(code));
}

// Decimals of the minor unit. Codes saved before the list existed fall back to Intl.
export function currencyDigits(code) {
  const known = find(code);
  if (known) return known.digits;
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2; } catch { return 2; }
}

// Formats an amount in minor units. Buyers see the symbol as written in their country
// (R$ 19,99); `code: true` shows the ISO code instead (BRL 19,99) for the admin, where
// stores in USD, MXN and ARS would otherwise all read "$".
export function formatCurrency(amount, currency, { code = false } = {}) {
  const digits = currencyDigits(currency);
  const value = amount / 10 ** digits;
  try {
    return new Intl.NumberFormat(find(currency)?.locale ?? 'en-US', {
      style: 'currency', currency, currencyDisplay: code ? 'code' : 'symbol',
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency}`;
  }
}

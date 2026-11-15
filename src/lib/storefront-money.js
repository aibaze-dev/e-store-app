// Public sales pages use Spanish formatting; internal accounting keeps its locale.
export function storefrontMoney(amount, currency) {
  const digits = new Intl.NumberFormat('es-AR', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  const value = amount / 10 ** digits;
  const formatted = new Intl.NumberFormat('es-AR', { minimumFractionDigits: Number.isInteger(value) ? 0 : digits, maximumFractionDigits: digits }).format(value);
  return `${currency === 'ARS' ? 'AR$' : currency === 'USD' ? 'US$' : currency} ${formatted}`;
}

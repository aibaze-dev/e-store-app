// Prices are stored in each currency's minor unit.
export function storefrontMoney(amount, currency) {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(amount / 10 ** digits);
}

import { currencyDigits, formatCurrency } from '../../shared/currencies.js';

// Prices are stored in each currency's minor unit and shown as buyers of that currency write them.
export function storefrontMoney(amount, currency) {
  return formatCurrency(amount, currency);
}

// Amount in whole units, as Meta Pixel expects its `value`.
export function majorAmount(amount, currency) {
  return amount / 10 ** currencyDigits(currency);
}

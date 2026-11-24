// Currencies a store can charge in. Every code is accepted by Stripe Checkout, and Stripe
// counts its decimals the same way Intl does, which is what turns prices into minor units.
// Add a currency only after checking both rules.
export const CURRENCIES = [
  { code: 'USD', name: 'Dólar estadounidense' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Libra esterlina' },
  { code: 'CAD', name: 'Dólar canadiense' },
  { code: 'AUD', name: 'Dólar australiano' },
  { code: 'MXN', name: 'Peso mexicano' },
  { code: 'ARS', name: 'Peso argentino' },
  { code: 'BRL', name: 'Real brasileño' },
  { code: 'CLP', name: 'Peso chileno' },
  { code: 'COP', name: 'Peso colombiano' },
  { code: 'PEN', name: 'Sol peruano' },
  { code: 'UYU', name: 'Peso uruguayo' },
  { code: 'PYG', name: 'Guaraní paraguayo' },
  { code: 'BOB', name: 'Boliviano' },
  { code: 'CRC', name: 'Colón costarricense' },
  { code: 'DOP', name: 'Peso dominicano' },
  { code: 'GTQ', name: 'Quetzal guatemalteco' },
];

const CODES = new Set(CURRENCIES.map(currency => currency.code));

export function isSupportedCurrency(code) {
  return CODES.has(String(code ?? '').trim().toUpperCase());
}

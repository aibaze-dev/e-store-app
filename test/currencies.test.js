import { describe, it, expect } from 'vitest';
import { CURRENCIES, currencyDigits, formatCurrency, isSupportedCurrency } from '../shared/currencies.js';
import { formatMoney, fromMinor, toMinor } from '../src/lib/format.js';
import { majorAmount, storefrontMoney } from '../src/lib/storefront-money.js';

// Stripe's zero-decimal currencies (docs.stripe.com/currencies#zero-decimal). Every other
// currency in our list is charged by Stripe in cents. A mismatch charges 100x more or less.
const STRIPE_ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
// Stripe's special cases (ISK, HUF, TWD, UGX) need rules we do not implement.
const STRIPE_SPECIAL = new Set(['ISK', 'HUF', 'TWD', 'UGX']);

describe('currency decimals', () => {
  it('match how Stripe counts the minor unit of every listed currency', () => {
    for (const { code, digits } of CURRENCIES) {
      expect(STRIPE_SPECIAL.has(code), code).toBe(false);
      expect(digits, code).toBe(STRIPE_ZERO_DECIMAL.has(code) ? 0 : 2);
      expect(currencyDigits(code), code).toBe(digits);
    }
  });

  it('do not follow Intl where it disagrees with Stripe (COP)', () => {
    expect(currencyDigits('COP')).toBe(2);
    expect(toMinor('19999', 'COP')).toBe(1999900);
    expect(formatCurrency(1999900, 'COP')).toBe('$ 19.999,00');
  });

  it('turn what the admin types into the integer sent to Stripe and back without drift', () => {
    for (const { code, digits } of CURRENCIES) {
      const typed = digits ? '19.99' : '19990';
      const minor = toMinor(typed, code);
      expect(minor, code).toBe(digits ? 1999 : 19990);
      expect(fromMinor(minor, code), code).toBe(typed);
      expect(toMinor('19,99', code), code).toBe(digits ? 1999 : NaN);
      expect(majorAmount(minor, code), code).toBe(Number(typed));
    }
  });

  it('rejects amounts it would otherwise misread by 100x or 1000x', () => {
    expect(toMinor('19.990', 'CLP')).toBeNaN();
    expect(toMinor('16.990', 'ARS')).toBeNaN();
    expect(toMinor('1,999.90', 'USD')).toBeNaN();
    expect(toMinor('19.999', 'USD')).toBeNaN();
    for (const text of ['', ' ', '-5', '1e3', 'abc', '10.']) expect(toMinor(text, 'USD'), text).toBeNaN();
    expect(toMinor(' 16990 ', 'ARS')).toBe(1699000);
    expect(toMinor('19.9', 'BRL')).toBe(1990);
  });

  it('format every listed currency with its full decimals', () => {
    for (const { code, digits } of CURRENCIES) {
      const text = formatCurrency(123456, code);
      expect(text, code).toMatch(digits ? /1[.,\s  ]?234[.,]56/ : /123[.,\s  ]456(?![.,]\d)/);
    }
  });
});

describe('price formatting', () => {
  it('shows buyers the symbol and separators of the currency country', () => {
    expect(storefrontMoney(1699050, 'ARS')).toBe('$ 16.990,50');
    expect(storefrontMoney(1999, 'BRL')).toBe('R$ 19,99');
    expect(storefrontMoney(1999, 'EUR')).toBe('19,99 €');
    expect(storefrontMoney(19990, 'CLP')).toBe('$19.990');
    expect(storefrontMoney(2700, 'USD')).toBe('$27.00');
  });

  it('shows the ISO code in the panel so stores that share "$" are told apart', () => {
    expect(formatMoney(1999, 'MXN')).toBe('MXN 19.99');
    expect(formatMoney(1699000, 'ARS')).toBe('ARS 16.990,00');
    expect(formatMoney(2700, 'USD')).toBe('USD 27.00');
  });

  it('keeps showing codes saved before the list existed', () => {
    expect(isSupportedCurrency('JPY')).toBe(false);
    expect(storefrontMoney(2700, 'JPY')).toBe('¥2,700');
    expect(majorAmount(2700, 'JPY')).toBe(2700);
  });
});

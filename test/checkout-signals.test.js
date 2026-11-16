import { describe, expect, it } from 'vitest';
import { checkoutDeadline, checkoutTimeLeft, randomShoppers } from '../src/storefront/checkoutSignals.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

describe('temporary checkout simulation', () => {
  it('starts at a random value around 15 minutes', () => {
    expect(checkoutTimeLeft(checkoutDeadline('a', null, 1000, () => 0), 1000)).toBe('14:00');
    expect(checkoutTimeLeft(checkoutDeadline('a', null, 1000, () => 0.5), 1000)).toBe('15:00');
    expect(checkoutTimeLeft(checkoutDeadline('a', null, 1000, () => 0.999999), 1000)).toBe('15:59');
  });

  it('always changes the shopper count within 2–15, including both endpoints', () => {
    expect(randomShoppers(undefined, () => 0)).toBe(2);
    expect(randomShoppers(undefined, () => 0.999999)).toBe(15);
    for (let previous = 2; previous <= 15; previous++) {
      for (let step = 0; step < 100; step++) {
        const count = randomShoppers(previous, () => step / 100);
        expect(count).toBeGreaterThanOrEqual(2);
        expect(count).toBeLessThanOrEqual(15);
        expect(count).not.toBe(previous);
      }
    }
  });

  it('preserves the deadline across reloads and starts a new cycle instead of staying at zero', () => {
    const storage = memoryStorage();
    const deadline = checkoutDeadline('a', storage, 1000, () => 0);
    expect(checkoutDeadline('a', storage, 4000)).toBe(deadline);
    expect(checkoutTimeLeft(deadline, 4000)).toBe('13:57');
    expect(checkoutTimeLeft(deadline, 121000)).toBe('12:00');
    expect(checkoutTimeLeft(deadline, deadline)).toBe('00:00');
    const next = checkoutDeadline('a', storage, deadline + 60000, () => 0.5);
    expect(checkoutTimeLeft(next, deadline + 60000)).toBe('15:00');
    expect(checkoutDeadline('a', storage, deadline + 61000)).toBe(next);
    expect(checkoutDeadline('b', storage, 4000, () => 0)).toBe(844000);
  });

  it('works with blocked storage and replaces corrupt or out-of-range values', () => {
    const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); } };
    expect(checkoutDeadline('a', blocked, 1000, () => 0)).toBe(841000);
    for (const value of ['bad', '-4', 'Infinity', '99999999']) {
      const storage = memoryStorage();
      storage.setItem('checkout-simulation:v2:a', value);
      expect(checkoutDeadline('a', storage, 1000, () => 0)).toBe(841000);
    }
  });
});

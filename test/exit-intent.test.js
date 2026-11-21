import { describe, it, expect, vi, afterEach } from 'vitest';
import { claimExitIntent, exitIntentCopy, claimSessionExit, canShowExit, leftDocument } from '../src/storefront/exitIntent.js';

const money = amount => `$${amount / 100}`;
const view = (offer = {}, content = {}) => ({
  offer: { main: { name: 'Guía de inversión', price: 2700 }, bonuses: [], ...offer },
  content: { hero: { ctaText: 'Quiero mi copia' }, guarantee: { enabled: true, text: '' }, ...content },
});
afterEach(() => vi.unstubAllGlobals());

describe('exit intent copy', () => {
  it('only states what the offer backs: no savings, bonuses or guarantee unless configured', () => {
    const copy = exitIntentCopy(view(), 'landing', money);
    expect(copy).toMatchObject({ emoji: '👋', title: 'Hold on a second', button: 'Quiero mi copia', closing: 'Pay securely and get instant access.' });
    expect(copy.intro).toContain('Guía de inversión');
    expect(copy.bullets).toEqual(['Get the e-book as soon as your payment is confirmed', 'One-time payment', 'Secure checkout']);
    expect(JSON.stringify(copy)).not.toMatch(/guarantee|sav(e|ings)|bonus|\$/i);
  });
  it('uses the real bonuses, savings and guarantee days, within four bullets', () => {
    const full = view(
      { main: { name: 'Guía', price: 2700, compareAtPrice: 5400 }, bonuses: [{ name: 'Plantillas', referenceValue: 2700 }, { name: 'Checklist' }] },
      { guarantee: { enabled: true, text: 'Devolución total.', days: 7 } },
    );
    const copy = exitIntentCopy(full, 'checkout', money);
    expect(copy.bullets).toEqual(['Get the e-book as soon as your payment is confirmed', 'Get 2 free bonuses', 'Save $54 (67% off the regular value)', 'One-time payment']);
    expect(copy.closing).toBe('Your purchase includes a 7-day guarantee.');
    expect(copy.button).toBe('Return to checkout');
    const hidden = exitIntentCopy(view({}, { guarantee: { enabled: false, text: 'Devolución total.', days: 7 } }), 'landing', money);
    expect(hidden.closing).not.toMatch(/guarantee/i);
    expect(exitIntentCopy(view({ bonuses: [{ name: 'Plantillas' }] }), 'landing', money).bullets[1]).toBe('Get Plantillas as a free bonus');
  });
});

describe('exit intent trigger', () => {
  const viewport = { innerWidth: 1200, innerHeight: 800 };
  const leave = (clientX, clientY, extra = {}) => ({ pointerType: 'mouse', relatedTarget: null, clientX, clientY, ...extra });
  it('fires for a mouse leaving through any edge', () => {
    for (const [x, y] of [[600, -3], [600, 803], [-2, 400], [1204, 400], [0, 400], [600, 0]]) expect(leftDocument(leave(x, y), viewport)).toBe(true);
  });
  it('ignores moves inside the page, into other elements and touch or pen pointers', () => {
    expect(leftDocument(leave(600, 400), viewport)).toBe(false);
    expect(leftDocument(leave(600, -3, { relatedTarget: {} }), viewport)).toBe(false);
    expect(leftDocument(leave(600, -3, { pointerType: 'touch' }), viewport)).toBe(false);
    expect(leftDocument(leave(600, -3, { pointerType: 'pen' }), viewport)).toBe(false);
  });
});

describe('exit intent cooldown', () => {
  it('allows the first appearance immediately and ignores events until 10s since the last appearance', () => {
    const scope = 'cooldown-boundary';
    expect(claimExitIntent(scope, 0)).toBe(true);
    expect(claimExitIntent(scope, 0)).toBe(false);
    expect(claimExitIntent(scope, 5_000)).toBe(false);
    expect(claimExitIntent(scope, 9_999)).toBe(false);
    expect(claimExitIntent(scope, 10_000)).toBe(true);
    expect(claimExitIntent(scope, 19_999)).toBe(false);
    expect(claimExitIntent(scope, 20_000)).toBe(true);
  });
  it('shares the cooldown for the same store while keeping other stores independent', () => {
    expect(claimExitIntent('cooldown-store-a', 100)).toBe(true);
    expect(claimExitIntent('cooldown-store-a', 200)).toBe(false);
    expect(claimExitIntent('cooldown-store-b', 200)).toBe(true);
  });
});

describe('exit intent session', () => {
  it('counts landing and checkout separately and reads saved counts after a reload', () => {
    const store = new Map([['exit-intent:v2:prior:checkout', '1']]);
    vi.stubGlobal('sessionStorage', { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) });
    expect(claimSessionExit('test', 'landing')).toBe(true);
    expect(claimSessionExit('test', 'landing')).toBe(false);
    expect(claimSessionExit('test', 'checkout')).toBe(true);
    expect(claimSessionExit('test', 'checkout')).toBe(true);
    expect(claimSessionExit('test', 'checkout')).toBe(false);
    expect(store.get('exit-intent:v2:test:checkout')).toBe('2');
    expect(claimSessionExit('prior', 'checkout')).toBe(true);
    expect(canShowExit('prior', 'checkout')).toBe(false);
  });
  it('keeps the limit in memory when storage is blocked', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked });
    expect(claimSessionExit('blocked', 'landing')).toBe(true);
    expect(canShowExit('blocked', 'landing')).toBe(false);
  });
});

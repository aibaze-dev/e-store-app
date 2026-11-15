import { describe, it, expect, vi, afterEach } from 'vitest';
import { claimExitIntent, exitIntentCopy, exitIntentSession, leftDocument } from '../src/storefront/exitIntent.js';

const money = amount => `$${amount / 100}`;
const view = (offer = {}, content = {}) => ({
  offer: { main: { name: 'Guía de inversión', price: 2700 }, bonuses: [], ...offer },
  content: { hero: { ctaText: 'Quiero mi copia' }, guarantee: { enabled: true, text: '' }, ...content },
});
afterEach(() => vi.unstubAllGlobals());

describe('exit intent copy', () => {
  it('only states what the offer backs: no savings, bonuses or guarantee unless configured', () => {
    const copy = exitIntentCopy(view(), 'landing', money);
    expect(copy).toMatchObject({ emoji: '👋', title: 'Pará un segundo', button: 'Quiero mi copia', closing: 'El pago es seguro y el acceso es inmediato.' });
    expect(copy.intro).toContain('Guía de inversión');
    expect(copy.bullets).toEqual(['Accedés al ebook apenas se confirma el pago', 'Es un único pago', 'Pagás de forma segura']);
    expect(JSON.stringify(copy)).not.toMatch(/garant|ahorr|bono|\$/i);
  });
  it('uses the real bonuses, savings and guarantee days, within four bullets', () => {
    const full = view(
      { main: { name: 'Guía', price: 2700, compareAtPrice: 5400 }, bonuses: [{ name: 'Plantillas', referenceValue: 2700 }, { name: 'Checklist' }] },
      { guarantee: { enabled: true, text: 'Devolución total.', days: 7 } },
    );
    const copy = exitIntentCopy(full, 'checkout', money);
    expect(copy.bullets).toEqual(['Accedés al ebook apenas se confirma el pago', 'Sumás 2 bonos gratis', 'Ahorrás $54 (67% OFF) sobre el valor de referencia', 'Es un único pago']);
    expect(copy.closing).toBe('Comprás con garantía de 7 días.');
    expect(copy.button).toBe('Volver a mi compra');
    const hidden = exitIntentCopy(view({}, { guarantee: { enabled: false, text: 'Devolución total.', days: 7 } }), 'landing', money);
    expect(hidden.closing).not.toMatch(/garant/i);
    expect(exitIntentCopy(view({ bonuses: [{ name: 'Plantillas' }] }), 'landing', money).bullets[1]).toBe('Sumás gratis el bono «Plantillas»');
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
  it('remembers per tab in sessionStorage and per landing', () => {
    const store = new Map();
    vi.stubGlobal('sessionStorage', { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) });
    expect(exitIntentSession.seen('tienda-a')).toBe(false);
    exitIntentSession.mark('tienda-a');
    expect(store.get('exit-intent:tienda-a')).toBe('1');
    expect(exitIntentSession.seen('tienda-a')).toBe(true);
    expect(exitIntentSession.seen('tienda-b')).toBe(false);
  });
  it('falls back to memory when storage is blocked', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked });
    expect(exitIntentSession.seen('tienda-c')).toBe(false);
    expect(() => exitIntentSession.mark('tienda-c')).not.toThrow();
    expect(exitIntentSession.seen('tienda-c')).toBe(true);
  });
});

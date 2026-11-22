import { afterEach, describe, expect, it, vi } from 'vitest';

// A page where Meta's script is already present: `fbq` only records its calls.
async function page() {
  vi.resetModules();
  const fbq = vi.fn();
  const stored = new Map();
  vi.stubGlobal('window', { fbq });
  vi.stubGlobal('sessionStorage', { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) });
  return { fbq, ...await import('../src/lib/pixel.js') };
}

afterEach(() => vi.unstubAllGlobals());

describe('Meta Pixel events', () => {
  it('sends each event to every pixel of the store and initialises each pixel once', async () => {
    const { fbq, trackPixel } = await page();
    trackPixel(['11111', '22222'], 'PageView');
    trackPixel(['11111', '22222'], 'InitiateCheckout', { value: 27, currency: 'USD' });
    expect(fbq.mock.calls).toEqual([
      ['init', '11111'], ['trackSingle', '11111', 'PageView', {}, undefined],
      ['init', '22222'], ['trackSingle', '22222', 'PageView', {}, undefined],
      ['trackSingle', '11111', 'InitiateCheckout', { value: 27, currency: 'USD' }, undefined],
      ['trackSingle', '22222', 'InitiateCheckout', { value: 27, currency: 'USD' }, undefined],
    ]);
  });

  it('sends the page view once per pixel, also when the landing and the quiz both ask for it', async () => {
    const { fbq, trackPageView } = await page();
    const views = () => fbq.mock.calls.filter(call => call[2] === 'PageView').map(call => call[1]);
    trackPageView(['11111']);
    trackPageView(['11111']);
    expect(views()).toEqual(['11111']);
    // A pixel added while the page is open gets its own; the first one is not repeated.
    trackPageView(['11111', '22222']);
    expect(views()).toEqual(['11111', '22222']);
    trackPageView(undefined);
    expect(views()).toEqual(['11111', '22222']);
  });

  it('does nothing for a store without pixels', async () => {
    const { fbq, trackPixel, trackPixelOnce } = await page();
    trackPixel([], 'PageView');
    trackPixel(undefined, 'PageView');
    trackPixelOnce('purchase-cs_1', [], 'Purchase', { value: 27, currency: 'USD' });
    expect(fbq).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('purchase-cs_1')).toBeNull();
  });

  it('sends a purchase once per session, to every pixel, with the same event id', async () => {
    const { fbq, trackPixelOnce } = await page();
    const purchase = () => trackPixelOnce('purchase-cs_1', ['11111', '22222'], 'Purchase', { value: 27, currency: 'USD' });
    purchase();
    purchase();
    expect(fbq.mock.calls.filter(call => call[0] === 'trackSingle')).toEqual([
      ['trackSingle', '11111', 'Purchase', { value: 27, currency: 'USD' }, { eventID: 'purchase-cs_1' }],
      ['trackSingle', '22222', 'Purchase', { value: 27, currency: 'USD' }, { eventID: 'purchase-cs_1' }],
    ]);
  });
});

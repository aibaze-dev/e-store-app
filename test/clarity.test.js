import { describe, expect, it, vi } from 'vitest';
import { CLARITY_DELAY_MS, CLARITY_IDLE_TIMEOUT_MS, clarityTags, runLast, startClarity } from '../src/lib/clarity.js';
import tracking from '../src/config/trackingData.json';

// A window whose load event, timers and idle time the test fires by hand.
function page({ readyState = 'loading', idle = true } = {}) {
  const listeners = [];
  const timers = [];
  const idles = [];
  const win = {
    document: { readyState },
    addEventListener: (type, listener, options) => listeners.push({ type, listener, options }),
    setTimeout: (callback, ms) => timers.push({ callback, ms }),
    ...(idle ? { requestIdleCallback: (callback, options) => idles.push({ callback, options }) } : {}),
  };
  const fire = queue => queue.splice(0).forEach(entry => (entry.listener ?? entry.callback)());
  return { win, listeners, timers, idles, load: () => fire(listeners), tick: () => fire(timers), rest: () => fire(idles) };
}

describe('Clarity loads last', () => {
  it('waits for the page to load, then for the delay, then for the browser to be idle', () => {
    const { win, listeners, timers, idles, load, tick, rest } = page();
    const run = vi.fn();
    runLast(run, win);
    expect(listeners).toMatchObject([{ type: 'load', options: { once: true } }]);
    expect(timers).toHaveLength(0);
    load();
    expect(timers.map(timer => timer.ms)).toEqual([CLARITY_DELAY_MS]);
    expect(idles).toHaveLength(0);
    tick();
    expect(idles.map(entry => entry.options)).toEqual([{ timeout: CLARITY_IDLE_TIMEOUT_MS }]);
    expect(run).not.toHaveBeenCalled();
    rest();
    expect(run).toHaveBeenCalledTimes(1);
    expect([listeners, timers, idles].map(queue => queue.length)).toEqual([0, 0, 0]);
  });

  it('skips the load event on a page that already loaded and still waits for the delay', () => {
    const { win, listeners, timers, tick, rest } = page({ readyState: 'complete' });
    const run = vi.fn();
    runLast(run, win);
    expect(listeners).toHaveLength(0);
    expect(timers.map(timer => timer.ms)).toEqual([CLARITY_DELAY_MS]);
    tick(); rest();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timer in browsers without requestIdleCallback', () => {
    const { win, timers, load, tick } = page({ idle: false });
    const run = vi.fn();
    runLast(run, win);
    load(); tick();
    expect(run).not.toHaveBeenCalled();
    expect(timers.map(timer => timer.ms)).toEqual([0]);
    tick();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('tags a recording with its store and, when the visit came from one, its campaign and ad', () => {
    expect(clarityTags('libro', undefined)).toEqual({ store: 'libro' });
    expect(clarityTags('libro', { source: 'ig', campaign: 'Ventas Noviembre', content: 'Video testimonio', adId: '120210000000003' }))
      .toEqual({ store: 'libro', campaign: 'Ventas Noviembre', ad: 'Video testimonio' });
    expect(clarityTags('libro', { source: 'newsletter' })).toEqual({ store: 'libro' });
  });

  it('never starts outside a production build', () => {
    expect(tracking.clarityProjectId).toMatch(/^[a-z0-9]+$/);
    // Would throw here if it reached the page: tests have no window.
    expect(() => startClarity({ store: 'libro' })).not.toThrow();
  });
});

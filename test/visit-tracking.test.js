import { describe, expect, it, vi } from 'vitest';
import { BROWSER_ID_KEY, createVisitTracker, visitStorageKey } from '../src/storefront/visitTracking.js';
import { dateKey } from '../shared/analytics.js';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const visit = { subdomain: 'libro', storeId: 'store-one', page: 'landing' };
const start = Date.parse('2026-11-15T10:00:00Z');
function setup(extra = {}) {
  const local = storage();
  let time = start;
  const options = { getStorage: () => local, now: () => time, timeZone: 'America/Adak', ...extra };
  const record = vi.fn(async () => ({ status: 'recorded', day: dateKey(time, options.timeZone) }));
  return { local, options, record, tracker: createVisitTracker(options), setTime: value => { time = value; } };
}

describe('persistent daily visit guard', () => {
  it('avoids duplicate mounts, reloads and later tabs after confirmation', async () => {
    const { tracker, options, record, local } = setup();
    await Promise.all([tracker.track(visit, record), tracker.track(visit, record)]);
    await createVisitTracker(options).track(visit, record); // reload/new tab
    expect(record).toHaveBeenCalledTimes(1);
    expect(local.getItem(BROWSER_ID_KEY)).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.parse(local.getItem(visitStorageKey(visit.storeId, visit.page)))).toEqual({
      day: '2026-11-15', confirmed: true, eventId: record.mock.calls[0][0].eventId,
    });
    expect(Object.keys(record.mock.calls[0][0]).sort()).toEqual(['eventId', 'page', 'subdomain']);
    expect(record.mock.calls[0][0].eventId).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps pages and stores separate and renews at business midnight', async () => {
    const { tracker, record, setTime, local } = setup();
    await tracker.track(visit, record);
    await tracker.track({ ...visit, page: 'checkout' }, record);
    await tracker.track({ ...visit, storeId: 'store-two', subdomain: 'otro' }, record);
    setTime(Date.parse('2026-11-16T09:59:59Z'));
    await tracker.track(visit, record); // still Nov 15 in Adak
    expect(record).toHaveBeenCalledTimes(3);
    setTime(Date.parse('2026-11-16T10:00:00Z'));
    await tracker.track(visit, record);
    expect(record).toHaveBeenCalledTimes(4);
    expect(new Set(record.mock.calls.map(([args]) => args.eventId)).size).toBe(4);
    expect(JSON.parse(local.getItem(visitStorageKey('store-one', 'landing'))).day).toBe('2026-11-16');
  });

  it('keeps the same event ID after a failed ACK and marks only confirmed events', async () => {
    const { tracker, options, local, record } = setup();
    record.mockRejectedValueOnce(new Error('response lost'));
    await expect(tracker.track(visit, record)).rejects.toThrow('response lost');
    expect(local.getItem(visitStorageKey('store-one', 'landing'))).toBeNull();
    record.mockResolvedValueOnce({ status: 'duplicate', day: '2026-11-15' });
    await createVisitTracker(options).track(visit, record);
    expect(record.mock.calls[0][0].eventId).toBe(record.mock.calls[1][0].eventId);
    await createVisitTracker(options).track(visit, record);
    expect(record).toHaveBeenCalledTimes(2);
  });

  it('never suppresses another attempt after server rejection', async () => {
    const { tracker, record, local } = setup();
    record.mockResolvedValueOnce(null); // unavailable/draft/rate limited
    expect(await tracker.track(visit, record)).toBe(false);
    expect(local.getItem(visitStorageKey('store-one', 'landing'))).toBeNull();
    expect(await tracker.track(visit, record)).toBe(true);
    expect(record.mock.calls[0][0].eventId).toBe(record.mock.calls[1][0].eventId);
  });

  it('survives unavailable storage and denied locks using memory', async () => {
    const { tracker, record } = setup({
      getStorage: () => { throw new Error('blocked'); },
      getLocks: () => ({ request: () => Promise.reject(new Error('denied')) }),
    });
    await tracker.track(visit, record);
    await tracker.track(visit, record);
    await tracker.track({ ...visit, page: 'checkout' }, record);
    expect(record).toHaveBeenCalledTimes(2);
  });

  it('repairs corrupted markers and browser IDs, and tolerates quota errors', async () => {
    const { tracker, local, record } = setup();
    local.setItem(BROWSER_ID_KEY, 'broken');
    local.setItem(visitStorageKey('store-one', 'landing'), '{bad');
    await tracker.track(visit, record);
    expect(record).toHaveBeenCalledTimes(1);
    const quota = setup({ getStorage: () => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } }) });
    await quota.tracker.track(visit, quota.record);
    await quota.tracker.track(visit, quota.record);
    expect(quota.record).toHaveBeenCalledTimes(1);
  });

  it('serializes first visits from separate tabs, including initial browser ID creation', async () => {
    const tails = new Map();
    const locks = { request: (key, callback) => {
      const work = (tails.get(key) ?? Promise.resolve()).then(callback);
      tails.set(key, work.catch(() => {}));
      return work;
    } };
    const { options, record } = setup({ getLocks: () => locks });
    const a = createVisitTracker(options), b = createVisitTracker(options);
    await Promise.all([a.track(visit, record), b.track(visit, record), b.track({ ...visit, page: 'checkout' }, record)]);
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls.map(([args]) => args.page).sort()).toEqual(['checkout', 'landing']);
  });

  it('uses deterministic server keys even without Web Locks once the browser ID exists', async () => {
    const { options, local, record } = setup();
    local.setItem(BROWSER_ID_KEY, 'stable-browser-id-123456');
    await Promise.all([createVisitTracker(options).track(visit, record), createVisitTracker(options).track(visit, record)]);
    expect(record.mock.calls.length).toBeGreaterThan(0);
    expect(new Set(record.mock.calls.map(([args]) => args.eventId)).size).toBe(1);
  });

  it('trusts the confirmed server day when delivery crosses midnight', async () => {
    const { tracker, setTime, record, local } = setup();
    record.mockResolvedValueOnce({ status: 'recorded', day: '2026-11-16' });
    await tracker.track(visit, record);
    setTime(Date.parse('2026-11-16T10:00:01Z'));
    await tracker.track(visit, record);
    expect(record).toHaveBeenCalledTimes(1);
    expect(JSON.parse(local.getItem(visitStorageKey('store-one', 'landing'))).day).toBe('2026-11-16');
  });
});

import { dateKey } from '../../shared/analytics.js';

export const BROWSER_ID_KEY = 'ebook_analytics_browser_id';
export const visitStorageKey = (storeId, page) => `ebook_analytics_visit_${storeId}_${page}`;
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{16,64}$/.test(value);

// Storage is a delivery guard, not the analytics database. One small marker per
// store/page is replaced each day; the actual history and IP uniques live in Convex.
export function createVisitTracker({ getStorage, getLocks = () => null, now = Date.now, randomId = () => crypto.randomUUID(), timeZone }) {
  const memory = new Map();
  const pending = new Map();
  const read = key => {
    try { return getStorage()?.getItem(key) ?? memory.get(key) ?? null; }
    catch { return memory.get(key) ?? null; }
  };
  const write = (key, value) => {
    memory.set(key, value);
    try { getStorage()?.setItem(key, value); } catch { /* blocked/quota: retain the in-memory guard */ }
  };
  const lock = async (key, work) => {
    let locks;
    try { locks = getLocks(); } catch { /* unavailable: use stable IDs and server deduplication */ }
    if (!locks?.request) return work();
    let started = false;
    try { return await locks.request(key, () => { started = true; return work(); }); }
    catch (error) {
      if (started) throw error;
      // Some privacy/sandbox policies expose the API but refuse lock acquisition.
      return work();
    }
  };
  const browserId = () => lock(BROWSER_ID_KEY, () => {
    let id = read(BROWSER_ID_KEY);
    if (!validId(id)) { id = randomId(); write(BROWSER_ID_KEY, id); }
    return id;
  });

  return {
    track({ subdomain, storeId = subdomain, page }, record) {
      const key = visitStorageKey(storeId, page);
      // Also coalesces React Strict Mode and simultaneous mounts in this document.
      if (pending.has(key)) return pending.get(key);
      const request = Promise.resolve().then(() => lock(key, async () => {
        const day = dateKey(now(), timeZone);
        let previous;
        try { previous = JSON.parse(read(key)); } catch { /* damaged or older marker */ }
        if (previous?.day === day && previous?.confirmed === true && /^[a-f0-9]{64}$/.test(previous?.eventId)) return true;
        const id = await browserId();
        // Deterministic across reloads/tabs, even when an ACK is lost. No raw browser
        // ID is sent or stored on the server; every store/page/day has a different key.
        const bytes = new TextEncoder().encode(JSON.stringify(['visit-v1', id, storeId, page, day]));
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const eventId = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
        const result = await record({ subdomain, page, eventId });
        if (result?.status !== 'recorded' && result?.status !== 'duplicate') return false;
        // The server's day wins if midnight was crossed while the request travelled.
        write(key, JSON.stringify({ day: result.day, eventId, confirmed: true }));
        return true;
      })).finally(() => { pending.delete(key); });
      pending.set(key, request);
      return request;
    },
  };
}

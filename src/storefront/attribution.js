import { cleanAttribution, parseAttribution } from '../../shared/attribution.js';

export const ATTRIBUTION_TTL_MS = 7 * 86_400_000;
export const attributionStorageKey = subdomain => `ebook_attribution_${subdomain}`;

// Remembers the campaign of the last ad link that opened this store, so the visit, the quiz
// and the order can carry it after the address loses its parameters. Storage only carries
// it between pages: the history lives in Convex. A later visit without parameters keeps
// the last campaign for a week.
export function createAttributionStore({ getStorage, now = Date.now }) {
  const memory = new Map();
  const seen = new Map();
  const load = subdomain => {
    if (memory.has(subdomain)) return memory.get(subdomain);
    try { return JSON.parse(getStorage()?.getItem(attributionStorageKey(subdomain)) ?? 'null'); }
    catch { return null; }
  };
  return {
    capture(subdomain, search) {
      // Called on every render of the storefront; the same address is read once.
      if (seen.get(subdomain) === search) return;
      seen.set(subdomain, search);
      const value = parseAttribution(search);
      if (!value) return;
      const record = { at: now(), value };
      memory.set(subdomain, record);
      try { getStorage()?.setItem(attributionStorageKey(subdomain), JSON.stringify(record)); } catch { /* blocked/quota: memory holds it for this visit */ }
    },
    read(subdomain) {
      const record = load(subdomain);
      if (!record || typeof record.at !== 'number' || now() - record.at > ATTRIBUTION_TTL_MS) return undefined;
      return cleanAttribution(record.value);
    },
  };
}

const store = createAttributionStore({ getStorage: () => window.localStorage });

export const captureAttribution = subdomain => store.capture(subdomain, window.location.search);

// Spread into the arguments of a call: nothing is sent when there is no campaign.
export function attributionArgs(subdomain) {
  const attribution = store.read(subdomain);
  return attribution ? { attribution } : {};
}

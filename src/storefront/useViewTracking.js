import { useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/lib/api.js';
import business from '@/config/businessData.json';
import { createVisitTracker } from './visitTracking.js';

const tracker = createVisitTracker({
  getStorage: () => window.localStorage,
  getLocks: () => navigator.locks,
  timeZone: business.timeZone,
});

// Mounted only on real public pages, never in the editor/preview template.
export function useViewTracking(subdomain, page, storeId, origin = page === 'landing' ? 'classic' : 'direct') {
  const record = useMutation(api.analytics.recordView);
  useEffect(() => {
    let active = true;
    let retry;
    let retries = 0;
    const send = () => {
      if (!active || document.visibilityState === 'hidden') return;
      clearTimeout(retry);
      void tracker.track({ subdomain, page, storeId: `${storeId}:${origin}` }, args => record({...args,origin})).then(confirmed => {
        if (!confirmed) scheduleRetry();
      }).catch(() => {
        // Failed deliveries remain retryable with the same event ID.
        scheduleRetry();
      });
    };
    const scheduleRetry = () => {
      if (active && retries < 2) { retries++; clearTimeout(retry); retry = setTimeout(send, 3000 * retries); }
    };
    send();
    document.addEventListener('visibilitychange', send);
    window.addEventListener('online', send);
    return () => {
      active = false;
      clearTimeout(retry);
      document.removeEventListener('visibilitychange', send);
      window.removeEventListener('online', send);
    };
  }, [subdomain, page, storeId, record, origin]);
}

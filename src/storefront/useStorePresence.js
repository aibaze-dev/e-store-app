import { useEffect } from 'react';
import { useConvexConnectionState, useMutation } from 'convex/react';
import { api } from '@/lib/api.js';
import { PRESENCE_REFRESH_MS } from '../../shared/analytics.js';

const memory = new Map();
function sessionFor(subdomain) {
  const key = `ebook_presence_${subdomain}`;
  if (memory.has(key)) return memory.get(key);
  let id;
  try {
    id = sessionStorage.getItem(key);
    if (!id || !/^[a-zA-Z0-9-]{16,64}$/.test(id)) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
  } catch { id = crypto.randomUUID(); }
  memory.set(key, id);
  return id;
}

export function useStorePresence(subdomain, page) {
  const { isWebSocketConnected } = useConvexConnectionState();
  const heartbeat = useMutation(api.storefront.heartbeat);
  useEffect(() => {
    if (!subdomain || !isWebSocketConnected) return;
    const sessionId = sessionFor(subdomain);
    let sending = false;
    const send = async () => {
      if (sending || document.hidden || !navigator.onLine) return;
      sending = true;
      try { await heartbeat({ subdomain, sessionId, page }); }
      catch { /* Retry on the next heartbeat. */ }
      finally { sending = false; }
    };
    send();
    const timer = window.setInterval(send, PRESENCE_REFRESH_MS);
    document.addEventListener('visibilitychange', send);
    window.addEventListener('online', send);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', send);
      window.removeEventListener('online', send);
    };
  }, [subdomain, page, heartbeat, isWebSocketConnected]);
}

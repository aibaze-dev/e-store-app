import { useEffect, useState } from 'react';

// index.html asks Convex for the landing while the bundle is still downloading and leaves
// the request in window.__earlyLanding. It is only a head start: the live query replaces
// its answer as soon as it arrives, and a failed request simply resolves to undefined.
function earlyFor(subdomain) {
  const early = typeof window === 'undefined' ? null : window.__earlyLanding;
  return early && early.subdomain === subdomain ? early : null;
}

export function useEarlyLanding(subdomain) {
  const [state, setState] = useState(() => ({ subdomain, value: earlyFor(subdomain)?.value }));
  useEffect(() => {
    const early = earlyFor(subdomain);
    if (!early) return;
    let active = true;
    early.promise.then(value => { if (active) setState({ subdomain, value }); });
    return () => { active = false; };
  }, [subdomain]);
  return state.subdomain === subdomain ? state.value || undefined : undefined;
}

import tracking from '../config/trackingData.json';

// Microsoft Clarity: session recordings and heatmaps of the public funnel (landing, quiz,
// checkout and offer). It is the last thing a page loads: nothing the visitor needs waits
// for it, so a recording starts a few seconds into the visit.
export const CLARITY_DELAY_MS = 3000;
export const CLARITY_IDLE_TIMEOUT_MS = 5000;

// Calls `run` once the page finished loading, the delay passed (the landing fetches the
// checkout code 2 s after it opens) and the browser has nothing else to do.
export function runLast(run, win = window) {
  // Safari has no requestIdleCallback.
  const idle = () => { win.requestIdleCallback ? win.requestIdleCallback(() => run(), { timeout: CLARITY_IDLE_TIMEOUT_MS }) : win.setTimeout(run, 0); };
  const wait = () => { win.setTimeout(idle, CLARITY_DELAY_MS); };
  if (win.document.readyState === 'complete') wait();
  else win.addEventListener('load', wait, { once: true });
}

// Tags to filter recordings by store and by the ad that brought the visitor.
export function clarityTags(subdomain, attribution) {
  const tags = { store: subdomain };
  if (attribution?.campaign) tags.campaign = attribution.campaign;
  if (attribution?.content) tags.ad = attribution.content;
  return tags;
}

let started = false;

// Starts Clarity once per page load, in production builds only. Recording then follows the
// visitor through the funnel; /gracias opens with a full page load, where nothing starts it.
export function startClarity(tags = {}) {
  const projectId = tracking.clarityProjectId;
  if (started || !projectId || !import.meta.env.PROD) return;
  started = true;
  runLast(() => {
    import('@microsoft/clarity').then(({ default: Clarity }) => {
      Clarity.init(projectId);
      for (const [key, value] of Object.entries(tags)) Clarity.setTag(key, value);
    }).catch(() => { /* recordings are optional: the page works without them */ });
  });
}

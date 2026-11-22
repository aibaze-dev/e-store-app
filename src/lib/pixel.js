// Meta Pixel, loaded only for stores that configured at least one id.
const loaded = new Set();

function initPixel(pixelId) {
  if (loaded.has(pixelId)) return;
  if (!window.fbq) {
    const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
    window.fbq = fbq; window._fbq = fbq;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  window.fbq('init', pixelId);
  loaded.add(pixelId);
}

// Sends the event to every pixel of the store. Meta attributes each conversion per ad account,
// so pixels of different business portfolios can share a landing.
export function trackPixel(pixelIds, event, params, eventId) {
  for (const pixelId of pixelIds || []) {
    initPixel(pixelId);
    // `trackSingle` keeps the event away from pixels other stores initialised on this page.
    window.fbq('trackSingle', pixelId, event, params || {}, eventId ? { eventID: eventId } : undefined);
  }
}

// PageView of a visit, sent when the landing or the quiz opens. Each pixel gets it once per page
// load: the store's data refreshes while the page is open and the visitor may move between both.
const viewed = new Set();
export function trackPageView(pixelIds) {
  const fresh = (pixelIds || []).filter(pixelId => !viewed.has(pixelId));
  fresh.forEach(pixelId => viewed.add(pixelId));
  trackPixel(fresh, 'PageView');
}

// Fires an event once per browser session for a given key (for example a paid checkout).
export function trackPixelOnce(key, pixelIds, event, params) {
  if (!pixelIds?.length) return;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { /* storage unavailable: the event is still sent */ }
  trackPixel(pixelIds, event, params, key);
}

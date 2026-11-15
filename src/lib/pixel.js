// Meta Pixel, loaded only for stores that configured an id.
let loadedId = '';

export function initPixel(pixelId) {
  if (!pixelId || loadedId === pixelId) return;
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
  loadedId = pixelId;
}

export function trackPixel(pixelId, event, params, eventId) {
  if (!pixelId) return;
  initPixel(pixelId);
  window.fbq('track', event, params || {}, eventId ? { eventID: eventId } : undefined);
}

// Fires an event once per browser session for a given key (for example a paid checkout).
export function trackPixelOnce(key, pixelId, event, params) {
  if (!pixelId) return;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { /* storage unavailable: the event is still sent */ }
  trackPixel(pixelId, event, params, key);
}

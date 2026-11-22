// Meta Pixel ids of a store: every event is sent to all of them.
export const MAX_PIXELS = 5;

// Stores saved before a store could hold several pixels only have a single `metaPixelId`.
export function pixelIds(tracking) {
  return tracking?.metaPixelIds ?? (tracking?.metaPixelId ? [tracking.metaPixelId] : []);
}

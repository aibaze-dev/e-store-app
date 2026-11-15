// Shared defaults keep older published landings compatible with the editor.
export const PROMOTION_COPY = {
  timerLabel: 'La oferta vence en',
  spotsText: 'Quedan {cantidad} cupos a este precio',
};

export const ACTIVITY_COPY = {
  viewersText: '{cantidad} personas viendo este producto ahora',
  salesText: '{cantidad} compras confirmadas',
  purchaseText: '{nombre} compró el e-book',
  purchaseLocationText: 'desde {ciudad}',
};

export const ACTIVITY_DEFAULTS = { viewers: true, notifications: true, salesCount: true };

// Replace only known placeholders, once; inserted values are never interpreted.
export function formatLandingText(template, values) {
  return template.replace(/\{([^{}]+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}

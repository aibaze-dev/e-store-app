// Shared defaults keep older published landings compatible with the editor.
export const PROMOTION_COPY = {
  timerLabel: 'Offer ends in',
  spotsText: '{cantidad} spots left at this price',
};

export const PURCHASE_NOTICE_COPY = {
  purchaseText: '{nombre} purchased the e-book',
  purchaseLocationText: 'from {ciudad}',
  noticeAge: '{minutos} min ago',
  noticeExample: 'Verified purchase',
  noticeClose: 'Close purchase notification',
};

// Published content can contain a saved copy of the previous defaults.
const previousNoticeDefaults = {
  purchaseText: '{nombre} compró el e-book',
  purchaseLocationText: 'desde {ciudad}',
  noticeAge: 'hace {minutos} min',
  noticeExample: 'Aviso de ejemplo',
  noticeClose: 'Cerrar aviso de compra',
};

export function upgradeNoticeDefaults(copy) {
  const result = { ...copy };
  for (const [key, previous] of Object.entries(previousNoticeDefaults)) {
    if (result[key] === previous) result[key] = PURCHASE_NOTICE_COPY[key];
  }
  return result;
}

export const ACTIVITY_COPY = {
  viewersText: '{cantidad} people are viewing this product now',
  salesText: '{cantidad} confirmed purchases',
  purchaseText: PURCHASE_NOTICE_COPY.purchaseText,
  purchaseLocationText: PURCHASE_NOTICE_COPY.purchaseLocationText,
};

export const ACTIVITY_DEFAULTS = { viewers: true, notifications: true, salesCount: true };

// Replace only known placeholders, once; inserted values are never interpreted.
export function formatLandingText(template, values) {
  return template.replace(/\{([^{}]+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}

// Visible landing labels, grouped into the form section where they appear.
// Defaults preserve existing publications; an explicitly empty label stays empty.
export const LANDING_LABEL_FIELDS = {
  savings: { section: 'cover', label: 'Texto del ahorro', value: 'You save {importe}', hint: 'Usá {importe} para mostrar la diferencia entre el precio tachado y el precio de venta del producto principal.' },
  access: { section: 'cover', label: 'Texto de acceso inmediato', value: 'Instant access' },
  payment: { section: 'cover', label: 'Texto de pago seguro', value: 'Secure checkout' },
  guarantee: { section: 'cover', label: 'Texto de garantía automática', value: '{dias}-day guarantee', hint: 'Usá {dias}. Estos textos se usan si la línea debajo del botón está vacía.' },
  discount: { section: 'offerTimer', label: 'Etiqueta del descuento', value: '{porcentaje}% OFF', hint: 'Usá {porcentaje}. Se muestra cuando el producto principal tiene precio tachado y no escribiste una etiqueta propia.' },
  hours: { section: 'offerTimer', label: 'Contador: horas', value: 'hrs' },
  minutes: { section: 'offerTimer', label: 'Contador: minutos', value: 'min' },
  seconds: { section: 'offerTimer', label: 'Contador: segundos', value: 'sec' },
  free: { section: 'offer', label: 'Etiqueta del bono gratuito', value: 'Free', hint: 'También se usa en los bonos en tarjetas y en el resumen de valor.' },
  bonusNumber: { section: 'bonusCards', label: 'Número de cada bono', value: 'Bonus {numero}', hint: 'Usá {numero}. También encabeza cada bono en el resumen de valor.' },
  bonusIncluded: { section: 'bonusCards', label: 'Pie de la tarjeta sin valor de referencia', value: 'Included with your purchase' },
  bonusValue: { section: 'bonusCards', label: 'Pie de la tarjeta con valor de referencia', value: 'Value:' },
  included: { section: 'valueStack', label: 'Etiqueta de las líneas incluidas', value: 'Included' },
  listen: { section: 'benefits', label: 'Botón para activar el sonido del video', value: 'Tap to unmute' },
  reference: { section: 'benefits', label: 'Etiqueta del valor total', value: 'Total value:' },
  today: { section: 'benefits', label: 'Etiqueta del precio actual', value: 'Today’s price:' },
  customers: { section: 'socialProof', label: 'Etiqueta de clientes', value: 'Customers' },
  rating: { section: 'socialProof', label: 'Etiqueta de calificación', value: 'Rating' },
  satisfaction: { section: 'socialProof', label: 'Etiqueta de satisfacción', value: 'Satisfaction' },
  verified: { section: 'socialProof', label: 'Sello de compra verificada', value: 'Verified purchase' },
  allAdded: { section: 'combo', label: 'Botón cuando ya se agregaron todos los extras', value: 'All items added' },
  comboSavings: { section: 'combo', label: 'Texto del ahorro del combo', value: 'You save {importe}', hint: 'Usá {importe} para sumar los descuentos del producto principal y de los extras seleccionados al valor de los bonos incluidos.' },
  total: { section: 'combo', label: 'Etiqueta del total a pagar', value: 'Total' },
  rights: { section: 'identity', label: 'Texto de derechos del pie de página', value: 'All rights reserved.' },
  terms: { section: 'identity', label: 'Texto del enlace de términos', value: 'Terms and conditions' },
  privacy: { section: 'identity', label: 'Texto del enlace de privacidad', value: 'Privacy policy' },
};
export const LANDING_LABEL_DEFAULTS = Object.fromEntries(Object.entries(LANDING_LABEL_FIELDS).map(([key, field]) => [key, field.value]));

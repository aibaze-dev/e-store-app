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

// Visible landing labels, grouped into the form section where they appear.
// Defaults preserve existing publications; an explicitly empty label stays empty.
export const LANDING_LABEL_FIELDS = {
  savings: { section: 'cover', label: 'Texto del ahorro', value: 'Ahorrás {importe}', hint: 'Usá {importe} para mostrar el ahorro calculado.' },
  access: { section: 'cover', label: 'Texto de acceso inmediato', value: 'Acceso inmediato' },
  payment: { section: 'cover', label: 'Texto de pago seguro', value: 'Pago seguro' },
  guarantee: { section: 'cover', label: 'Texto de garantía automática', value: 'Garantía {dias} días', hint: 'Usá {dias}. Estos textos se usan si la línea debajo del botón está vacía.' },
  free: { section: 'offer', label: 'Etiqueta del bono gratuito', value: 'Gratis' },
  listen: { section: 'benefits', label: 'Botón para activar el sonido del video', value: 'Tocá para escuchar' },
  reference: { section: 'benefits', label: 'Etiqueta del valor total', value: 'Valor total:' },
  today: { section: 'benefits', label: 'Etiqueta del precio actual', value: 'Hoy solo:' },
  customers: { section: 'socialProof', label: 'Etiqueta de clientes', value: 'Clientes' },
  rating: { section: 'socialProof', label: 'Etiqueta de calificación', value: 'Calificación' },
  satisfaction: { section: 'socialProof', label: 'Etiqueta de satisfacción', value: 'Satisfacción' },
  verified: { section: 'socialProof', label: 'Sello de compra verificada', value: 'Compra verificada' },
  allAdded: { section: 'combo', label: 'Botón cuando ya se agregaron todos los extras', value: 'Todo agregado' },
  comboSavings: { section: 'combo', label: 'Texto del ahorro del combo', value: 'Te ahorrás {importe}', hint: 'Usá {importe} para mostrar el ahorro calculado.' },
  total: { section: 'combo', label: 'Etiqueta del total a pagar', value: 'Total' },
  rights: { section: 'identity', label: 'Texto de derechos del pie de página', value: 'Todos los derechos reservados.' },
  terms: { section: 'identity', label: 'Texto del enlace de términos', value: 'Términos y condiciones' },
  privacy: { section: 'identity', label: 'Texto del enlace de privacidad', value: 'Política de privacidad' },
};
export const LANDING_LABEL_DEFAULTS = Object.fromEntries(Object.entries(LANDING_LABEL_FIELDS).map(([key, field]) => [key, field.value]));

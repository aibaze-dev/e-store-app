import { CHECKOUT_FIELDS, CHECKOUT_DEFAULTS } from './checkout-copy.js';
import { formatLandingText } from './landing-copy.js';
export const POST_LABEL_FIELDS = {
  "paidEyebrow": {
    "group": "confirmation",
    "label": "Etiqueta de compra confirmada",
    "value": "Compra confirmada"
  },
  "paidTitle": {
    "group": "confirmation",
    "label": "Título de agradecimiento",
    "value": "¡Gracias por tu compra!"
  },
  "emailedText": {
    "group": "confirmation",
    "label": "Mensaje con email enviado",
    "value": "Estos son tus links. También te los enviamos por email."
  },
  "savedText": {
    "group": "confirmation",
    "label": "Mensaje sin envío por email",
    "value": "Estos son tus links. Guardá la dirección de esta página: es la forma de volver a verlos."
  },
  "linksTitle": {
    "group": "access",
    "label": "Título de accesos",
    "value": "Tus links de acceso"
  },
  "linksEyebrow": {
    "group": "access",
    "label": "Etiqueta de accesos",
    "value": "Tu compra"
  },
  "linksSubtitle": {
    "group": "access",
    "label": "Subtítulo de accesos",
    "value": ""
  },
  "open": {
    "group": "access",
    "label": "Botón de acceso",
    "value": "Abrir"
  },
  "emptyLinks": {
    "group": "access",
    "label": "Compra sin accesos",
    "value": "Esta compra no tiene links cargados. Escribile a quien te vendió el producto."
  },
  "discount": {
    "group": "offer",
    "label": "Etiqueta de ahorro",
    "value": "Ahorrás {porcentaje}%"
  },
  "offerDescription": {
    "group": "offer",
    "label": "Descripción accesible de la oferta",
    "value": "Oferta especial para sumar a tu compra"
  },
  "benefitsTitle": {
    "group": "offer",
    "label": "Título alternativo de beneficios",
    "value": "Qué incluye esta oferta"
  },
  "preparing": {
    "group": "offer",
    "label": "Preparando el pago",
    "value": "Preparando el pago…"
  },
  "startError": {
    "group": "offer",
    "label": "Error al iniciar el pago",
    "value": "No se pudo iniciar el pago. Volvé a intentar."
  },
  "access": {
    "group": "offer",
    "label": "Sello de acceso",
    "value": "Acceso inmediato"
  },
  "secure": {
    "group": "offer",
    "label": "Sello de seguridad",
    "value": "Pago seguro"
  },
  "paymentNote": {
    "group": "offer",
    "label": "Aclaración del cobro",
    "value": "Se paga aparte. Tu compra anterior no cambia."
  },
  "close": {
    "group": "offer",
    "label": "Cerrar oferta (accesibilidad)",
    "value": "Cerrar"
  },
  "videoTitle": {
    "group": "video",
    "label": "Título alternativo del video",
    "value": "Video de la oferta"
  },
  "videoError": {
    "group": "video",
    "label": "Error del video",
    "value": "No se pudo cargar el video. Podés abrirlo en otra pestaña o continuar con la oferta."
  },
  "videoUnsupported": {
    "group": "video",
    "label": "Video incompatible",
    "value": "Tu navegador no puede reproducir este video."
  },
  "videoOpen": {
    "group": "video",
    "label": "Enlace para abrir el video",
    "value": "Abrir video en otra pestaña"
  },
  "loadingTitle": {
    "group": "states",
    "label": "Buscando compra",
    "value": "Buscando tu compra"
  },
  "missingTitle": {
    "group": "states",
    "label": "Compra no encontrada",
    "value": "No encontramos esta compra"
  },
  "missingText": {
    "group": "states",
    "label": "Ayuda de compra no encontrada",
    "value": "Abrí el link completo de la página a la que te llevó el pago. Si el problema sigue, escribile a quien te vendió el producto."
  },
  "pendingTitle": {
    "group": "states",
    "label": "Título de pago pendiente",
    "value": "Estamos confirmando tu pago"
  },
  "pendingText": {
    "group": "states",
    "label": "Texto de pago pendiente",
    "value": "Suele tardar unos segundos. No cierres esta página: tus links aparecen acá apenas se confirme."
  },
  "reviewTitle": {
    "group": "states",
    "label": "Título de pago en revisión",
    "value": "Estamos revisando tu pago"
  },
  "reviewText": {
    "group": "states",
    "label": "Texto de pago en revisión",
    "value": "Recibimos el pago, pero necesitamos verificarlo antes de entregar tus links. Te vamos a contactar al email que usaste en la compra."
  },
  "refundedTitle": {
    "group": "states",
    "label": "Título de reembolso",
    "value": "Esta compra fue reembolsada"
  },
  "refundedText": {
    "group": "states",
    "label": "Texto de reembolso",
    "value": "Los links de esta compra ya no están disponibles."
  },
  "failedTitle": {
    "group": "states",
    "label": "Título de pago incompleto",
    "value": "El pago no se completó"
  },
  "failedText": {
    "group": "states",
    "label": "Pago rechazado",
    "value": "Tu banco rechazó el pago y no se realizó ningún cobro. Podés volver a intentarlo con otro medio."
  },
  "expiredText": {
    "group": "states",
    "label": "Pago vencido",
    "value": "No se realizó ningún cobro. Podés volver a intentarlo."
  },
  "back": {
    "group": "states",
    "label": "Botón para volver",
    "value": "Volver a la oferta"
  },
  "rights": {
    "group": "footer",
    "label": "Derechos del pie",
    "value": "Todos los derechos reservados."
  },
  "terms": {
    "group": "footer",
    "label": "Enlace de términos",
    "value": "Términos y condiciones"
  },
  "privacy": {
    "group": "footer",
    "label": "Enlace de privacidad",
    "value": "Política de privacidad"
  },
  "legal": {
    "group": "footer",
    "label": "Nombre del menú legal",
    "value": "Información legal"
  }
};
export const BACK_POPUP_FIELDS = {
  "modalTitle": {
    "label": "Título del popup",
    "value": "¡Esperá! Tenemos un regalo para vos 🎁"
  },
  "modalSubtitle": {
    "label": "Texto del popup",
    "value": "Antes de irte, mirá esta oferta exclusiva con un descuento que solo está disponible ahora."
  },
  "acceptText": {
    "label": "Botón para ver la oferta",
    "value": "Ver oferta"
  },
  "declineText": {
    "label": "Botón para rechazar",
    "value": "No, gracias"
  },
  "pageTitle": {
    "label": "Título de la oferta",
    "value": "Acabás de desbloquear una oferta secreta 🔓"
  },
  "pageSubtitle": {
    "label": "Descripción de la oferta",
    "value": "Sabemos que el precio puede ser una traba. Por eso queremos hacerte llegar esto al alcance, con un descuento especial que solo aparece una vez."
  },
  "close": {
    "label": "Cerrar popup (accesibilidad)",
    "value": "Cerrar"
  },
  "offerLabel": {
    "label": "Nombre del resumen",
    "value": "Tu oferta"
  },
  "savings": {
    "label": "Etiqueta del ahorro",
    "value": "(Ahorrás {porcentaje}%)"
  },
  "bonuses": {
    "label": "Bonos incluidos",
    "value": "+ Bonos gratis incluidos"
  },
  "subtotal": {
    "label": "Subtotal",
    "value": "Subtotal"
  },
  "discount": {
    "label": "Descuento",
    "value": "Descuento"
  },
  "cta": {
    "label": "Botón para comprar con descuento",
    "value": "Sí, lo quiero con descuento"
  }
};
export const POST_LABEL_DEFAULTS = Object.fromEntries(Object.entries(POST_LABEL_FIELDS).map(([key, field]) => [key, field.value]));
export const POST_LABEL_GROUPS = { confirmation: 'Confirmación de compra', access: 'Links y entrega', offer: 'Textos adicionales de la oferta', video: 'Video', states: 'Estados de la compra', footer: 'Pie y enlaces legales' };
export const POST_OPTION_FIELDS = { showCover: 'Mostrar portada de la oferta', showDiscount: 'Mostrar etiqueta de ahorro', showTrust: 'Mostrar sellos de confianza', showPaymentNote: 'Mostrar aclaración de cobro separado' };
export const POPUP_OPTION_FIELDS = { landingExit: 'Mostrar popup al salir de la landing', backLanding: 'Mostrar oferta al volver atrás en la landing', backCheckout: 'Mostrar oferta al volver atrás en el checkout', postEnabled: 'Mostrar ofertas post-compra', postOnLoad: 'Abrir post-compra al confirmar la compra', postOnReturn: 'Reabrir post-compra al volver a la pestaña', postOnExit: 'Reabrir post-compra al salir con el mouse', postDownsell: 'Mostrar segunda oferta con descuento', postFinal: 'Mostrar última oportunidad' };
export const POST_OPTION_DEFAULTS = Object.fromEntries(Object.keys(POST_OPTION_FIELDS).map(key => [key, true]));
export const POPUP_OPTION_DEFAULTS = Object.fromEntries(Object.keys(POPUP_OPTION_FIELDS).map(key => [key, true]));
export const LANDING_EXIT_FIELDS = Object.fromEntries(Object.entries(CHECKOUT_FIELDS).filter(([, field]) => field.group === 'exit'));
export const DOWNSELL_DEFAULTS = Object.fromEntries(Object.entries(BACK_POPUP_FIELDS).filter(([key]) => ['modalTitle', 'modalSubtitle', 'acceptText', 'declineText', 'pageTitle', 'pageSubtitle'].includes(key)).map(([key, field]) => [key, field.value]));
export const postLabels = (content = {}) => ({ ...POST_LABEL_DEFAULTS, ...content.postLabels });
export const postOptions = (content = {}) => ({ ...POST_OPTION_DEFAULTS, ...content.postOptions });
export const popupOptions = (content = {}) => ({ ...POPUP_OPTION_DEFAULTS, ...content.popupOptions });
export const purchaseText = (copy, key, values = {}) => formatLandingText(copy[key], values);
export const landingExitConfig = (view = {}) => ({
  ...Object.fromEntries(Object.keys(LANDING_EXIT_FIELDS).map(key => [key, CHECKOUT_DEFAULTS[key]])),
  exitIntro: 'Antes de irte, mirá lo que te llevás hoy con «{producto}».',
  exitButton: view.content?.hero?.ctaText || 'Comprar ahora',
  ...view.content?.landingExit,
});
export function backPopupConfig(view = {}) {
  return { ...Object.fromEntries(Object.entries(BACK_POPUP_FIELDS).map(([key, field]) => [key, field.value])),
    ...Object.fromEntries(Object.keys(DOWNSELL_DEFAULTS).filter(key => view.downsell?.[key]?.trim()).map(key => [key, view.downsell[key]])),
    ...view.content?.backPopup,
  };
}
export const PURCHASE_PREVIEW_STATES = { offer: 'Oferta', preparing: 'Preparando pago', error: 'Error al iniciar pago', payment: 'Formulario de pago', processing: 'Procesando pago', 'payment-error': 'Error al confirmar el pago', 'payment-loading': 'Cargando medios de pago', videoError: 'Error del video', paid: 'Compra confirmada con email', saved: 'Compra confirmada sin email', empty: 'Sin links cargados', loading: 'Buscando compra', missing: 'Compra no encontrada', pending: 'Pago pendiente', needs_review: 'Pago en revisión', failed: 'Pago rechazado', expired: 'Pago vencido', refunded: 'Compra reembolsada' };
export const POPUP_PREVIEW_TARGETS = { 'popup-exit-landing': 'Salida de la landing', 'popup-exit-checkout': 'Salida del checkout', 'popup-back-landing': 'Volver atrás · landing', 'popup-back-checkout': 'Volver atrás · checkout', 'popup-back-page': 'Página de oferta con descuento' };

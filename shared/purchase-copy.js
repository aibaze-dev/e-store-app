import { CHECKOUT_FIELDS, CHECKOUT_DEFAULTS, CHECKOUT_OPTIONAL_FIELDS } from './checkout-copy.js';
import { formatLandingText } from './landing-copy.js';
export const POST_LABEL_FIELDS = {
  "paidEyebrow": {
    "group": "confirmation",
    "label": "Etiqueta de compra confirmada",
    "value": "Purchase confirmed"
  },
  "paidTitle": {
    "group": "confirmation",
    "label": "Título de agradecimiento",
    "value": "Thank you for your purchase!"
  },
  "emailedText": {
    "group": "confirmation",
    "label": "Mensaje con email enviado",
    "value": "Your access links are below. We also sent them to your email."
  },
  "savedText": {
    "group": "confirmation",
    "label": "Mensaje sin envío por email",
    "value": "Your access links are below. Bookmark this page to find them again."
  },
  "celebrationTitle": {
    "group": "confirmation",
    "label": "Título de la animación de felicitaciones",
    "value": "Congratulations!"
  },
  "celebrationText": {
    "group": "confirmation",
    "label": "Texto de la animación de felicitaciones",
    "value": "You just got {producto}"
  },
  "linksTitle": {
    "group": "access",
    "label": "Título de accesos",
    "value": "Your access links"
  },
  "linksEyebrow": {
    "group": "access",
    "label": "Etiqueta de accesos",
    "value": "Your order"
  },
  "linksSubtitle": {
    "group": "access",
    "label": "Subtítulo de accesos",
    "value": ""
  },
  "open": {
    "group": "access",
    "label": "Botón de acceso",
    "value": "Open"
  },
  "download": {
    "group": "access",
    "label": "Botón de descarga",
    "value": "Download"
  },
  "downloading": {
    "group": "access",
    "label": "Descarga en curso",
    "value": "Downloading…"
  },
  "emptyLinks": {
    "group": "access",
    "label": "Compra sin accesos",
    "value": "There are no access links for this order. Please contact the seller."
  },
  "discount": {
    "group": "offer",
    "label": "Etiqueta de ahorro",
    "value": "Save {porcentaje}%"
  },
  "offerDescription": {
    "group": "offer",
    "label": "Descripción accesible de la oferta",
    "value": "Special offer for your order"
  },
  "benefitsTitle": {
    "group": "offer",
    "label": "Título alternativo de beneficios",
    "value": "What this offer includes"
  },
  "preparing": {
    "group": "offer",
    "label": "Preparando el pago",
    "value": "Preparing payment…"
  },
  "startError": {
    "group": "offer",
    "label": "Error al iniciar el pago",
    "value": "We couldn’t start your payment. Please try again."
  },
  "access": {
    "group": "offer",
    "label": "Sello de acceso",
    "value": "Instant access"
  },
  "secure": {
    "group": "offer",
    "label": "Sello de seguridad",
    "value": "Secure checkout"
  },
  "paymentNote": {
    "group": "offer",
    "label": "Aclaración del cobro",
    "value": "This is a separate charge. Your original order stays the same."
  },
  "close": {
    "group": "offer",
    "label": "Cerrar oferta (accesibilidad)",
    "value": "Close"
  },
  "videoTitle": {
    "group": "video",
    "label": "Título alternativo del video",
    "value": "Offer video"
  },
  "videoError": {
    "group": "video",
    "label": "Error del video",
    "value": "We couldn’t load the video. Open it in a new tab or continue with the offer."
  },
  "videoUnsupported": {
    "group": "video",
    "label": "Video incompatible",
    "value": "Your browser can’t play this video."
  },
  "videoOpen": {
    "group": "video",
    "label": "Enlace para abrir el video",
    "value": "Open video in a new tab"
  },
  "loadingTitle": {
    "group": "states",
    "label": "Buscando compra",
    "value": "Looking up your order"
  },
  "missingTitle": {
    "group": "states",
    "label": "Compra no encontrada",
    "value": "We couldn’t find your order"
  },
  "missingText": {
    "group": "states",
    "label": "Ayuda de compra no encontrada",
    "value": "Open the full link you received after checkout. If the problem continues, contact the seller."
  },
  "pendingTitle": {
    "group": "states",
    "label": "Título de pago pendiente",
    "value": "Confirming your payment"
  },
  "pendingText": {
    "group": "states",
    "label": "Texto de pago pendiente",
    "value": "This usually takes a few seconds. Keep this page open to see your links when your payment is confirmed."
  },
  "reviewTitle": {
    "group": "states",
    "label": "Título de pago en revisión",
    "value": "We’re reviewing your payment"
  },
  "reviewText": {
    "group": "states",
    "label": "Texto de pago en revisión",
    "value": "We received your payment and need to verify it before sharing your links. We’ll contact you at the email address you used at checkout."
  },
  "refundedTitle": {
    "group": "states",
    "label": "Título de reembolso",
    "value": "Your order was refunded"
  },
  "refundedText": {
    "group": "states",
    "label": "Texto de reembolso",
    "value": "The access links for this order are no longer available."
  },
  "failedTitle": {
    "group": "states",
    "label": "Título de pago incompleto",
    "value": "Your payment wasn’t completed"
  },
  "failedText": {
    "group": "states",
    "label": "Pago rechazado",
    "value": "Your bank declined the payment. You haven’t been charged. Try another payment method."
  },
  "expiredText": {
    "group": "states",
    "label": "Pago vencido",
    "value": "You haven’t been charged. You can try again."
  },
  "back": {
    "group": "states",
    "label": "Botón para volver",
    "value": "Back to offer"
  },
  "rights": {
    "group": "footer",
    "label": "Derechos del pie",
    "value": "All rights reserved."
  },
  "terms": {
    "group": "footer",
    "label": "Enlace de términos",
    "value": "Terms and conditions"
  },
  "privacy": {
    "group": "footer",
    "label": "Enlace de privacidad",
    "value": "Privacy policy"
  },
  "legal": {
    "group": "footer",
    "label": "Nombre del menú legal",
    "value": "Legal information"
  }
};
export const BACK_POPUP_FIELDS = {
  "modalTitle": {
    "label": "Título del popup",
    "value": "Wait! We have a gift for you 🎁"
  },
  "modalSubtitle": {
    "label": "Texto del popup",
    "value": "Before you go, take a look at this exclusive limited-time discount."
  },
  "acceptText": {
    "label": "Botón para ver la oferta",
    "value": "View offer"
  },
  "declineText": {
    "label": "Botón para rechazar",
    "value": "No thanks"
  },
  "pageTitle": {
    "label": "Título de la oferta",
    "value": "You’ve unlocked a special offer 🔓"
  },
  "pageSubtitle": {
    "label": "Descripción de la oferta",
    "value": "If the price was holding you back, here’s a one-time discount."
  },
  "close": {
    "label": "Cerrar popup (accesibilidad)",
    "value": "Close"
  },
  "offerLabel": {
    "label": "Nombre del resumen",
    "value": "Your offer"
  },
  "savings": {
    "label": "Etiqueta del ahorro",
    "value": "(Save {porcentaje}%)"
  },
  "bonuses": {
    "label": "Bonos incluidos",
    "value": "+ Free bonuses included"
  },
  "subtotal": {
    "label": "Subtotal",
    "value": "Subtotal"
  },
  "discount": {
    "label": "Descuento",
    "value": "Discount"
  },
  "cta": {
    "label": "Botón para comprar con descuento",
    "value": "Get the discounted offer"
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
// Descriptive texts may be left empty; titles, actions and accessible names fall back to their default.
export const POST_OPTIONAL_FIELDS = ['linksEyebrow', 'linksSubtitle', 'emailedText', 'savedText', 'paymentNote', 'rights'];
export const BACK_POPUP_OPTIONAL_FIELDS = ['modalSubtitle', 'pageSubtitle'];
export const LANDING_EXIT_OPTIONAL_FIELDS = CHECKOUT_OPTIONAL_FIELDS.filter(key => key in LANDING_EXIT_FIELDS);
export const filledTexts = (values = {}, optional = []) => Object.fromEntries(Object.entries(values ?? {}).filter(([key, value]) => typeof value === 'string' && (optional.includes(key) || value.trim())));
export const postLabels = (content = {}) => ({ ...POST_LABEL_DEFAULTS, ...filledTexts(content?.postLabels, POST_OPTIONAL_FIELDS) });
export const postOptions = (content = {}) => ({ ...POST_OPTION_DEFAULTS, ...content.postOptions });
export const popupOptions = (content = {}) => ({ ...POPUP_OPTION_DEFAULTS, ...content.popupOptions });
export const purchaseText = (copy, key, values = {}) => formatLandingText(copy[key], values);
export const landingExitConfig = (view = {}) => ({
  ...Object.fromEntries(Object.keys(LANDING_EXIT_FIELDS).map(key => [key, CHECKOUT_DEFAULTS[key]])),
  exitIntro: 'Before you go, see what you get with {producto}.',
  exitButton: view.content?.hero?.ctaText || 'Buy now',
  ...filledTexts(view.content?.landingExit, LANDING_EXIT_OPTIONAL_FIELDS),
});
export function backPopupConfig(view = {}) {
  return { ...Object.fromEntries(Object.entries(BACK_POPUP_FIELDS).map(([key, field]) => [key, field.value])),
    ...Object.fromEntries(Object.keys(DOWNSELL_DEFAULTS).filter(key => view.downsell?.[key]?.trim()).map(key => [key, view.downsell[key]])),
    ...filledTexts(view.content?.backPopup, BACK_POPUP_OPTIONAL_FIELDS),
  };
}
export const PURCHASE_PREVIEW_STATES = { offer: 'Oferta', preparing: 'Preparando pago', error: 'Error al iniciar pago', payment: 'Formulario de pago', processing: 'Procesando pago', 'payment-error': 'Error al confirmar el pago', 'payment-loading': 'Cargando medios de pago', videoError: 'Error del video', paid: 'Compra confirmada con email', saved: 'Compra confirmada sin email', empty: 'Sin links cargados', loading: 'Buscando compra', missing: 'Compra no encontrada', pending: 'Pago pendiente', needs_review: 'Pago en revisión', failed: 'Pago rechazado', expired: 'Pago vencido', refunded: 'Compra reembolsada' };
export const POPUP_PREVIEW_TARGETS = { 'popup-exit-landing': 'Salida de la landing', 'popup-exit-checkout': 'Salida del checkout', 'popup-back-landing': 'Volver atrás · landing', 'popup-back-checkout': 'Volver atrás · checkout', 'popup-back-page': 'Página de oferta con descuento' };

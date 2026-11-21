import { formatLandingText, PURCHASE_NOTICE_COPY, upgradeNoticeDefaults } from './landing-copy.js';

// One catalog drives defaults, form controls and server validation.
export const CHECKOUT_FIELDS = {
  "secure": {
    "group": "header",
    "label": "Pago seguro",
    "value": "Secure checkout"
  },
  "back": {
    "group": "header",
    "label": "Enlace para volver",
    "value": "Back to offer"
  },
  "title": {
    "group": "header",
    "label": "Título principal (accesibilidad)",
    "value": "Complete your purchase"
  },
  "guarantee": {
    "group": "header",
    "label": "Garantía con días",
    "value": "{dias}-day guarantee"
  },
  "guaranteeFallback": {
    "group": "header",
    "label": "Garantía sin días",
    "value": "Your purchase is covered by a guarantee"
  },
  "personalTitle": {
    "group": "personal",
    "label": "Título de datos personales",
    "value": "Contact information"
  },
  "emailLabel": {
    "group": "personal",
    "label": "Etiqueta de email",
    "value": "Email *"
  },
  "emailPlaceholder": {
    "group": "personal",
    "label": "Ejemplo de email",
    "value": "you@example.com"
  },
  "nameLabel": {
    "group": "personal",
    "label": "Etiqueta de nombre",
    "value": "Name *"
  },
  "namePlaceholder": {
    "group": "personal",
    "label": "Ejemplo de nombre",
    "value": "Your name"
  },
  "emailHint": {
    "group": "personal",
    "label": "Ayuda del email",
    "value": "We’ll send your access link to this email address."
  },
  "paymentTitle": {
    "group": "payment",
    "label": "Título del pago",
    "value": "Payment method"
  },
  "pay": {
    "group": "payment",
    "label": "Botón de pago",
    "value": "Pay {importe}"
  },
  "processing": {
    "group": "payment",
    "label": "Pago en proceso",
    "value": "Processing…"
  },
  "summaryTitle": {
    "group": "summary",
    "label": "Título del resumen",
    "value": "Order summary"
  },
  "total": {
    "group": "summary",
    "label": "Etiqueta del total",
    "value": "Total"
  },
  "savings": {
    "group": "summary",
    "label": "Ahorro",
    "value": "You save {importe}"
  },
  "oneBonus": {
    "group": "summary",
    "label": "Un bono incluido",
    "value": "+{cantidad} free bonus"
  },
  "manyBonuses": {
    "group": "summary",
    "label": "Varios bonos incluidos",
    "value": "+{cantidad} free bonuses"
  },
  "free": {
    "group": "summary",
    "label": "Etiqueta gratis",
    "value": "FREE"
  },
  "upsellTitle": {
    "group": "extras",
    "label": "Título de extras",
    "value": "Add to your order"
  },
  "add": {
    "group": "extras",
    "label": "Botón para agregar",
    "value": "Add to my order"
  },
  "added": {
    "group": "extras",
    "label": "Botón de extra agregado",
    "value": "Added to your order"
  },
  "discount": {
    "group": "extras",
    "label": "Etiqueta de descuento",
    "value": "−{porcentaje}% OFF"
  },
  "activityText": {
    "group": "activity",
    "label": "Barra de actividad",
    "value": "{cantidad} people are checking out right now"
  },
  "purchaseText": {
    "group": "activity",
    "label": "Aviso de compra",
    "value": PURCHASE_NOTICE_COPY.purchaseText
  },
  "purchaseLocationText": {
    "group": "activity",
    "label": "Ubicación del aviso",
    "value": PURCHASE_NOTICE_COPY.purchaseLocationText
  },
  "noticeAge": {
    "group": "activity",
    "label": "Antigüedad del aviso",
    "value": PURCHASE_NOTICE_COPY.noticeAge
  },
  "noticeExample": {
    "group": "activity",
    "label": "Etiqueta del aviso simulado",
    "value": PURCHASE_NOTICE_COPY.noticeExample
  },
  "noticeClose": {
    "group": "activity",
    "label": "Cerrar aviso (accesibilidad)",
    "value": PURCHASE_NOTICE_COPY.noticeClose
  },
  "privacy": {
    "group": "legal",
    "label": "Enlace de privacidad",
    "value": "Privacy policy"
  },
  "terms": {
    "group": "legal",
    "label": "Enlace de términos",
    "value": "Terms and conditions"
  },
  "legalLabel": {
    "group": "legal",
    "label": "Nombre del menú legal (accesibilidad)",
    "value": "Legal information"
  },
  "loading": {
    "group": "errors",
    "label": "Carga de medios de pago",
    "value": "Loading payment methods…"
  },
  "loadingSecure": {
    "group": "errors",
    "label": "Carga inicial del pago",
    "value": "Loading secure payment methods…"
  },
  "unavailable": {
    "group": "errors",
    "label": "Pagos deshabilitados",
    "value": "Payments aren’t available on this site yet."
  },
  "retry": {
    "group": "errors",
    "label": "Botón para reintentar",
    "value": "Try again"
  },
  "loadError": {
    "group": "errors",
    "label": "Error de carga del pago",
    "value": "We couldn’t load secure checkout. Refresh the page to try again."
  },
  "methodError": {
    "group": "errors",
    "label": "Error del medio de pago",
    "value": "We couldn’t load the payment method. Refresh the page to try again."
  },
  "sessionError": {
    "group": "errors",
    "label": "Error al iniciar la compra",
    "value": "We couldn’t start checkout. Please try again."
  },
  "expiredError": {
    "group": "errors",
    "label": "Sesión de pago vencida",
    "value": "Your checkout session expired. Nothing was charged."
  },
  "renew": {
    "group": "errors",
    "label": "Botón para reabrir el pago",
    "value": "Continue to payment"
  },
  "confirmError": {
    "group": "errors",
    "label": "Error al confirmar",
    "value": "We couldn’t confirm your payment. Check your details and try again."
  },
  "changedError": {
    "group": "errors",
    "label": "Cambio de precio o moneda",
    "value": "The offer has changed. Refresh the page to review your total before paying."
  },
  "emailError": {
    "group": "errors",
    "label": "Email requerido",
    "value": "Enter your email address."
  },
  "nameError": {
    "group": "errors",
    "label": "Nombre requerido",
    "value": "Enter your name."
  },
  "exitEmoji": {
    "group": "exit",
    "label": "Símbolo del popup",
    "value": "👋"
  },
  "exitTitle": {
    "group": "exit",
    "label": "Título del popup",
    "value": "Before you go"
  },
  "exitIntro": {
    "group": "exit",
    "label": "Introducción del popup",
    "value": "You’re one step away from getting {producto}. Here’s what your order includes."
  },
  "exitAccess": {
    "group": "exit",
    "label": "Acceso",
    "value": "Get the e-book as soon as your payment is confirmed"
  },
  "exitOneBonus": {
    "group": "exit",
    "label": "Un bono",
    "value": "Get {bono} as a free bonus"
  },
  "exitBonuses": {
    "group": "exit",
    "label": "Varios bonos",
    "value": "Get {cantidad} free bonuses"
  },
  "exitSavings": {
    "group": "exit",
    "label": "Ahorro del popup",
    "value": "Save {importe} ({porcentaje}% off the regular value)"
  },
  "exitSinglePayment": {
    "group": "exit",
    "label": "Pago único",
    "value": "One-time payment"
  },
  "exitSecure": {
    "group": "exit",
    "label": "Seguridad del pago",
    "value": "Secure checkout"
  },
  "exitButton": {
    "group": "exit",
    "label": "Botón del popup",
    "value": "Return to checkout"
  },
  "exitGuaranteeDays": {
    "group": "exit",
    "label": "Cierre con días de garantía",
    "value": "Your purchase includes a {dias}-day guarantee."
  },
  "exitGuarantee": {
    "group": "exit",
    "label": "Cierre con garantía sin días",
    "value": "Your purchase includes a guarantee. See the offer for details."
  },
  "exitClosing": {
    "group": "exit",
    "label": "Cierre sin garantía",
    "value": "Pay securely and get instant access."
  },
  "exitClose": {
    "group": "exit",
    "label": "Cerrar popup (accesibilidad)",
    "value": "Close"
  }
};
export const CHECKOUT_OPTIONAL_FIELDS = ['guaranteeFallback', 'emailHint', 'purchaseText', 'purchaseLocationText', 'noticeAge', 'noticeExample', 'exitEmoji', 'exitClosing', 'exitGuarantee', 'exitGuaranteeDays'];
export const CHECKOUT_GROUPS = { header: 'Encabezado y confianza', personal: 'Datos personales', payment: 'Pago', summary: 'Resumen de compra', extras: 'Extras', activity: 'Actividad y avisos', legal: 'Enlaces legales', errors: 'Carga, errores y validación', exit: 'Popup al salir' };
export const CHECKOUT_FLAGS = { showActivity: 'Mostrar barra de actividad simulada', showTimer: 'Mostrar contador (en el checkout, el vencimiento real de la sesión de pago)', notifications: 'Mostrar avisos de compra simulados', showTrust: 'Mostrar sellos de confianza', showGuarantee: 'Mostrar garantía configurada', showExit: 'Mostrar popup al salir' };
export const CHECKOUT_DEFAULTS = { ...Object.fromEntries(Object.entries(CHECKOUT_FIELDS).map(([key, field]) => [key, field.value])), ...Object.fromEntries(Object.keys(CHECKOUT_FLAGS).map(key => [key, true])), paymentLocale: 'en' };
export const checkoutText = (copy, key, values = {}) => formatLandingText(copy[key], values);
// Legacy store settings remain the fallback until a checkout draft is published.
export function checkoutConfig(view = {}) {
  const content = view.content ?? {};
  const copy = upgradeNoticeDefaults({ ...CHECKOUT_DEFAULTS,
    upsellTitle: view.checkout?.upsellTitle || CHECKOUT_DEFAULTS.upsellTitle,
    notifications: view.checkout?.notifications ?? content.activity?.notifications ?? true,
    purchaseText: content.activity?.purchaseText ?? CHECKOUT_DEFAULTS.purchaseText,
    purchaseLocationText: content.activity?.purchaseLocationText ?? CHECKOUT_DEFAULTS.purchaseLocationText,
    guaranteeFallback: content.guarantee?.title ?? CHECKOUT_DEFAULTS.guaranteeFallback,
    ...content.checkout,
  });
  if (/^\s*surname\s*\*?\s*$/i.test(copy.nameLabel)) copy.nameLabel = CHECKOUT_DEFAULTS.nameLabel;
  if (/^\s*(your )?surname\s*$/i.test(copy.namePlaceholder)) copy.namePlaceholder = CHECKOUT_DEFAULTS.namePlaceholder;
  return copy;
}

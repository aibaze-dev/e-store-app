import { formatLandingText } from './landing-copy.js';

// One catalog drives defaults, form controls and server validation.
export const CHECKOUT_FIELDS = {
  "secure": {
    "group": "header",
    "label": "Pago seguro",
    "value": "Pago seguro"
  },
  "back": {
    "group": "header",
    "label": "Enlace para volver",
    "value": "Volver a la oferta"
  },
  "title": {
    "group": "header",
    "label": "Título principal (accesibilidad)",
    "value": "Finalizá tu compra"
  },
  "guarantee": {
    "group": "header",
    "label": "Garantía con días",
    "value": "Garantía de {dias} días"
  },
  "guaranteeFallback": {
    "group": "header",
    "label": "Garantía sin días",
    "value": "Tu compra, con garantía"
  },
  "personalTitle": {
    "group": "personal",
    "label": "Título de datos personales",
    "value": "Datos personales"
  },
  "emailLabel": {
    "group": "personal",
    "label": "Etiqueta de email",
    "value": "Email *"
  },
  "emailPlaceholder": {
    "group": "personal",
    "label": "Ejemplo de email",
    "value": "tu@email.com"
  },
  "nameLabel": {
    "group": "personal",
    "label": "Etiqueta de nombre",
    "value": "Nombre *"
  },
  "namePlaceholder": {
    "group": "personal",
    "label": "Ejemplo de nombre",
    "value": "Tu nombre"
  },
  "emailHint": {
    "group": "personal",
    "label": "Ayuda del email",
    "value": "Te enviamos el acceso a tu compra a este email."
  },
  "paymentTitle": {
    "group": "payment",
    "label": "Título del pago",
    "value": "Método de pago"
  },
  "pay": {
    "group": "payment",
    "label": "Botón de pago",
    "value": "Pagar {importe}"
  },
  "processing": {
    "group": "payment",
    "label": "Pago en proceso",
    "value": "Procesando…"
  },
  "summaryTitle": {
    "group": "summary",
    "label": "Título del resumen",
    "value": "Resumen de tu compra"
  },
  "total": {
    "group": "summary",
    "label": "Etiqueta del total",
    "value": "Total"
  },
  "savings": {
    "group": "summary",
    "label": "Ahorro",
    "value": "Ahorrás {importe}"
  },
  "oneBonus": {
    "group": "summary",
    "label": "Un bono incluido",
    "value": "+{cantidad} bono gratis"
  },
  "manyBonuses": {
    "group": "summary",
    "label": "Varios bonos incluidos",
    "value": "+{cantidad} bonos gratis"
  },
  "free": {
    "group": "summary",
    "label": "Etiqueta gratis",
    "value": "GRATIS"
  },
  "upsellTitle": {
    "group": "extras",
    "label": "Título de extras",
    "value": "Sumá a tu compra"
  },
  "add": {
    "group": "extras",
    "label": "Botón para agregar",
    "value": "Agregar a mi compra"
  },
  "added": {
    "group": "extras",
    "label": "Botón de extra agregado",
    "value": "Agregado a tu compra"
  },
  "discount": {
    "group": "extras",
    "label": "Etiqueta de descuento",
    "value": "−{porcentaje}% OFF"
  },
  "activityText": {
    "group": "activity",
    "label": "Barra de actividad",
    "value": "{cantidad} personas están comprando en este momento"
  },
  "purchaseText": {
    "group": "activity",
    "label": "Aviso de compra",
    "value": "{nombre} compró el e-book"
  },
  "purchaseLocationText": {
    "group": "activity",
    "label": "Ubicación del aviso",
    "value": "desde {ciudad}"
  },
  "noticeAge": {
    "group": "activity",
    "label": "Antigüedad del aviso",
    "value": "hace {minutos} min"
  },
  "noticeExample": {
    "group": "activity",
    "label": "Etiqueta del aviso simulado",
    "value": "Aviso de ejemplo"
  },
  "noticeClose": {
    "group": "activity",
    "label": "Cerrar aviso (accesibilidad)",
    "value": "Cerrar aviso de compra"
  },
  "privacy": {
    "group": "legal",
    "label": "Enlace de privacidad",
    "value": "Política de privacidad"
  },
  "terms": {
    "group": "legal",
    "label": "Enlace de términos",
    "value": "Términos y condiciones"
  },
  "legalLabel": {
    "group": "legal",
    "label": "Nombre del menú legal (accesibilidad)",
    "value": "Información legal"
  },
  "loading": {
    "group": "errors",
    "label": "Carga de medios de pago",
    "value": "Cargando medios de pago…"
  },
  "loadingSecure": {
    "group": "errors",
    "label": "Carga inicial del pago",
    "value": "Cargando medios de pago seguros…"
  },
  "unavailable": {
    "group": "errors",
    "label": "Pagos deshabilitados",
    "value": "Los pagos todavía no están habilitados en este sitio."
  },
  "retry": {
    "group": "errors",
    "label": "Botón para reintentar",
    "value": "Reintentar"
  },
  "loadError": {
    "group": "errors",
    "label": "Error de carga del pago",
    "value": "No pudimos cargar el pago seguro. Recargá la página para reintentar."
  },
  "methodError": {
    "group": "errors",
    "label": "Error del medio de pago",
    "value": "No se pudo cargar el medio de pago. Recargá la página para reintentar."
  },
  "sessionError": {
    "group": "errors",
    "label": "Error al iniciar la compra",
    "value": "No pudimos cargar el pago. Volvé a intentar."
  },
  "confirmError": {
    "group": "errors",
    "label": "Error al confirmar",
    "value": "No pudimos confirmar el pago. Revisá tus datos y volvé a intentar."
  },
  "changedError": {
    "group": "errors",
    "label": "Cambio de precio o moneda",
    "value": "La oferta cambió. Recargá la página para revisar el total antes de pagar."
  },
  "emailError": {
    "group": "errors",
    "label": "Email requerido",
    "value": "Ingresá tu email."
  },
  "nameError": {
    "group": "errors",
    "label": "Nombre requerido",
    "value": "Completá tu nombre."
  },
  "exitEmoji": {
    "group": "exit",
    "label": "Símbolo del popup",
    "value": "👋"
  },
  "exitTitle": {
    "group": "exit",
    "label": "Título del popup",
    "value": "Pará un segundo"
  },
  "exitIntro": {
    "group": "exit",
    "label": "Introducción del popup",
    "value": "Estás a un paso de tener «{producto}». Antes de irte, mirá lo que incluye tu compra."
  },
  "exitAccess": {
    "group": "exit",
    "label": "Acceso",
    "value": "Accedés al ebook apenas se confirma el pago"
  },
  "exitOneBonus": {
    "group": "exit",
    "label": "Un bono",
    "value": "Sumás gratis el bono «{bono}»"
  },
  "exitBonuses": {
    "group": "exit",
    "label": "Varios bonos",
    "value": "Sumás {cantidad} bonos gratis"
  },
  "exitSavings": {
    "group": "exit",
    "label": "Ahorro del popup",
    "value": "Ahorrás {importe} ({porcentaje}% OFF) sobre el valor de referencia"
  },
  "exitSinglePayment": {
    "group": "exit",
    "label": "Pago único",
    "value": "Es un único pago"
  },
  "exitSecure": {
    "group": "exit",
    "label": "Seguridad del pago",
    "value": "Pagás de forma segura"
  },
  "exitButton": {
    "group": "exit",
    "label": "Botón del popup",
    "value": "Volver a mi compra"
  },
  "exitGuaranteeDays": {
    "group": "exit",
    "label": "Cierre con días de garantía",
    "value": "Comprás con garantía de {dias} días."
  },
  "exitGuarantee": {
    "group": "exit",
    "label": "Cierre con garantía sin días",
    "value": "Tu compra tiene garantía: las condiciones están en la página."
  },
  "exitClosing": {
    "group": "exit",
    "label": "Cierre sin garantía",
    "value": "El pago es seguro y el acceso es inmediato."
  },
  "exitClose": {
    "group": "exit",
    "label": "Cerrar popup (accesibilidad)",
    "value": "Cerrar"
  }
};
export const CHECKOUT_OPTIONAL_FIELDS = ['guaranteeFallback', 'emailHint', 'purchaseText', 'purchaseLocationText', 'noticeAge', 'noticeExample', 'exitEmoji', 'exitClosing', 'exitGuarantee', 'exitGuaranteeDays'];
export const CHECKOUT_GROUPS = { header: 'Encabezado y confianza', personal: 'Datos personales', payment: 'Pago', summary: 'Resumen de compra', extras: 'Extras', activity: 'Actividad y avisos', legal: 'Enlaces legales', errors: 'Carga, errores y validación', exit: 'Popup al salir' };
export const CHECKOUT_FLAGS = { showActivity: 'Mostrar barra de actividad simulada', showTimer: 'Mostrar contador simulado', notifications: 'Mostrar avisos de compra simulados', showTrust: 'Mostrar sellos de confianza', showGuarantee: 'Mostrar garantía configurada', showExit: 'Mostrar popup al salir' };
export const CHECKOUT_DEFAULTS = { ...Object.fromEntries(Object.entries(CHECKOUT_FIELDS).map(([key, field]) => [key, field.value])), ...Object.fromEntries(Object.keys(CHECKOUT_FLAGS).map(key => [key, true])), paymentLocale: 'es' };
export const checkoutText = (copy, key, values = {}) => formatLandingText(copy[key], values);
// Legacy store settings remain the fallback until a checkout draft is published.
export function checkoutConfig(view = {}) {
  const content = view.content ?? {};
  return { ...CHECKOUT_DEFAULTS,
    upsellTitle: view.checkout?.upsellTitle || CHECKOUT_DEFAULTS.upsellTitle,
    notifications: view.checkout?.notifications ?? content.activity?.notifications ?? true,
    purchaseText: content.activity?.purchaseText ?? CHECKOUT_DEFAULTS.purchaseText,
    purchaseLocationText: content.activity?.purchaseLocationText ?? CHECKOUT_DEFAULTS.purchaseLocationText,
    guaranteeFallback: content.guarantee?.title ?? CHECKOUT_DEFAULTS.guaranteeFallback,
    ...content.checkout,
  };
}

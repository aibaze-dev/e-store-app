export const LANDING_SECTIONS = {
  promotion: ['01', 'Barra de oferta y avisos'],
  hero: ['02', 'Encabezado'],
  cover: ['03', 'Portada y precio'],
  introduction: ['04', 'Introducción'],
  transformation: ['05', 'Antes y después'],
  painPoints: ['06', 'Si te pasa esto'],
  offer: ['07', 'Bonos'],
  steps: ['08', 'El método'],
  about: ['09', 'Quiénes somos'],
  showcase: ['10', 'Qué viene adentro'],
  benefits: ['11', 'Tu kit completo'],
  socialProof: ['12', 'Testimonios'],
  comparison: ['13', 'Comparación de caminos'],
  guarantee: ['14', 'Garantía'],
  faq: ['15', 'Preguntas frecuentes'],
  closing: ['16', 'Cierre'],
  combo: ['17', 'Armá tu combo y botón fijo'],
  identity: ['18', 'Identidad y dirección'],
  checkoutTimer: ['01', 'Contador del checkout'],
  postPurchase: ['02', 'Post-compra · Presentación'],
  postPurchaseBenefits: ['03', 'Post-compra · Beneficios'],
  postPurchaseVideo: ['04', 'Post-compra · Video VSL'],
  postPurchaseDownsell: ['05', 'Post-compra · Una oportunidad más'],
  postPurchaseFinal: ['06', 'Post-compra · Última oportunidad'],
  postPurchaseCopy: ['01', 'Textos y estados de post-compra'],
  popupLanding: ['01', 'Salida de la landing'], popupCheckout: ['02', 'Salida del checkout'], popupBack: ['03', 'Oferta al volver atrás'], popupPost: ['04', 'Popups después del pago'],
};

export const LANDING_TABS = [
  { id: 'landing', label: 'Config. landing' },
  { id: 'post', label: 'Post-compra' },
  { id: 'checkout', label: 'Checkout' },
  { id: 'popups', label: 'Popups' },
];

export function landingSectionTab(id = '') {
  if (id.startsWith('popup')) return 'popups';
  if (id.startsWith('postPurchase')) return 'post';
  if (id.startsWith('checkout')) return 'checkout';
  return 'landing';
}

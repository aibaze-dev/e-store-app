import { popupOptions } from './purchase-copy.js';

// The same availability rules as the public components; previews never invent an offer.
export function popupJourney(view) {
  const options = popupOptions(view.content);
  const post = view.postPurchaseOffer;
  const hasPost = Boolean(post);
  const reopens = options.postOnReturn || options.postOnExit;
  const hasDiscount = Boolean(hasPost && options.postDownsell && post.downsellPrice);
  return [
    { target: 'popup-exit-landing', group: 'Antes del pago', title: 'Salida de la landing', enabled: true, trigger: 'Al salir con el mouse, o al volver atrás en móvil. Una vez por pestaña.', accept: 'Lleva al checkout.', decline: 'Cierra el aviso.' },
    { target: 'popup-exit-checkout', group: 'Antes del pago', title: 'Salida del checkout', enabled: true, trigger: 'Al salir con el mouse, o al volver atrás en móvil. Hasta dos veces por pestaña.', accept: 'Vuelve al formulario de pago.', decline: 'Si hay descuento, se puede pedir la oferta.' },
    { target: 'popup-back-checkout', group: 'Antes del pago', title: 'Ver oferta', enabled: Boolean(view.downsell), trigger: 'El comprador pide un descuento en el aviso del checkout.', accept: 'Abre /oferta.', decline: 'Vuelve al checkout.' },
    { target: 'popup-offer-final', group: 'Antes del pago', title: 'Último descuento en /oferta', enabled: Boolean(view.downsell && view.downsell.finalPrice < view.downsell.price), trigger: 'El comprador pulsa “I’m not ready yet” en /oferta.', accept: 'Abre el pago del producto principal al precio final.', decline: 'Sale de la oferta.' },
    { target: 'post', group: 'Después del pago', title: '1. Oferta inicial', enabled: hasPost, trigger: 'La oferta con su VSL se abre al terminar u omitir la animación de compra confirmada.', accept: 'Abre el formulario para un pago adicional.', decline: hasDiscount ? 'Muestra la segunda oferta con descuento.' : 'Cierra el modal; puede continuar al reabrirse.' },
    { target: 'post-downsell', group: 'Después del pago', title: '2. Oferta con descuento', enabled: hasDiscount, trigger: 'Aparece al rechazar la oferta inicial, si hay un descuento configurado.', accept: 'Abre el formulario con el precio reducido.', decline: 'En la primera apertura cierra el modal; la última oportunidad aparece al reabrir. Si ya se reabrió, puede avanzar directamente a la última oferta.' },
    { target: 'post-final', group: 'Después del pago', title: '3. Última oportunidad', enabled: Boolean(hasPost && options.postFinal && reopens), trigger: 'Al volver a la pestaña o salir con el mouse, después de rechazar las ofertas anteriores.', accept: 'Abre el formulario con el precio final calculado.', decline: 'Termina el recorrido: no vuelve a abrirse.' },
  ];
}

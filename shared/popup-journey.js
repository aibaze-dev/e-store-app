import { popupOptions } from './purchase-copy.js';
import { checkoutConfig } from './checkout-copy.js';

// The same availability rules as the public components; previews never invent an offer.
export function popupJourney(view) {
  const options = popupOptions(view.content);
  const checkout = checkoutConfig(view);
  const post = view.postPurchaseOffer;
  const hasPost = Boolean(post && options.postEnabled);
  const reopens = options.postOnReturn || options.postOnExit;
  const hasDiscount = Boolean(hasPost && options.postDownsell && post.downsellPrice);
  return [
    { target: 'popup-exit-landing', group: 'Antes del pago', title: 'Salida de la landing', enabled: options.landingExit, trigger: 'El mouse sale de la página de venta. Puede reaparecer después de 10 segundos.', accept: 'Lleva al checkout.', decline: 'Cerrar vuelve a la landing.' },
    { target: 'popup-exit-checkout', group: 'Antes del pago', title: 'Salida del checkout', enabled: checkout.showExit, trigger: 'El mouse sale del checkout. Puede reaparecer después de 10 segundos.', accept: 'Vuelve al formulario de pago.', decline: 'Cerrar mantiene el checkout.' },
    { target: 'popup-back-landing', group: 'Antes del pago', title: 'Volver atrás en la landing', enabled: Boolean(view.downsell && options.backLanding), trigger: 'Se pulsa Atrás después de interactuar. Una vez por pestaña, compartida con el checkout.', accept: 'Abre la página del producto principal con descuento.', decline: 'Cierra el popup sin iniciar un pago.' },
    { target: 'popup-back-checkout', group: 'Antes del pago', title: 'Volver atrás en el checkout', enabled: Boolean(view.downsell && options.backCheckout), trigger: 'Se pulsa Atrás después de interactuar. Usa el mismo límite que la landing.', accept: 'Abre la página del producto principal con descuento.', decline: 'Cierra el popup sin iniciar un pago.' },
    { target: 'post', group: 'Después del pago', title: '1. Oferta inicial', enabled: Boolean(hasPost && (options.postOnLoad || reopens)), trigger: options.postOnLoad ? 'Se abre al confirmar la compra, si queda una oferta disponible.' : 'Se abre al volver a la pestaña o salir con el mouse, según los disparadores activos.', accept: 'Abre el formulario para un pago adicional.', decline: hasDiscount ? 'Muestra la segunda oferta con descuento.' : 'Cierra el modal; puede continuar al reabrirse.' },
    { target: 'post-downsell', group: 'Después del pago', title: '2. Oferta con descuento', enabled: hasDiscount, trigger: 'Aparece al rechazar la oferta inicial, si hay un descuento configurado.', accept: 'Abre el formulario con el precio reducido.', decline: 'Cierra el modal. La última oportunidad depende de una reapertura.' },
    { target: 'post-final', group: 'Después del pago', title: '3. Última oportunidad', enabled: Boolean(hasPost && options.postFinal && reopens), trigger: 'Al volver a la pestaña o salir con el mouse, después de rechazar las ofertas anteriores.', accept: 'Abre el formulario con el precio final calculado.', decline: 'Termina el recorrido: no vuelve a abrirse.' },
  ];
}

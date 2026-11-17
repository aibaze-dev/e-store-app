// Payment data stays inside Stripe Elements; only contact details reach this helper.
// Without `buyer` (post-purchase) the session already knows who pays; only a missing email is sent.
export async function confirmCheckout(checkout, buyer, expected, onInitiate, email = '') {
  if (checkout.total.total.minorUnitsAmount !== expected.total || checkout.currency.toUpperCase() !== expected.currency.toUpperCase()) {
    return { type: 'error', error: { message: 'La oferta cambió. Recargá la página para revisar el total antes de pagar.' } };
  }
  if (!buyer) {
    if (!checkout.email && !email.trim()) return { type: 'error', error: { message: 'Ingresá tu email.' } };
    onInitiate();
    return checkout.confirm(checkout.email ? undefined : { email: email.trim() });
  }
  const name = buyer.name.trim().replace(/\s+/g, ' ');
  if (!name) return { type: 'error', error: { message: 'Completá tu nombre.' } };
  if (!buyer.email.trim()) return { type: 'error', error: { message: 'Ingresá tu email.' } };
  const named = await checkout.updateIndividualName(name);
  if (named.type === 'error') return named;
  onInitiate();
  return checkout.confirm({ email: buyer.email.trim() });
}

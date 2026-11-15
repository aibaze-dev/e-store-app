// Payment data stays inside Stripe Elements; only contact details reach this helper.
export async function confirmCheckout(checkout, buyer, expected, onInitiate) {
  if (checkout.total.total.minorUnitsAmount !== expected.total || checkout.currency.toUpperCase() !== expected.currency.toUpperCase()) {
    return { type: 'error', error: { message: 'La oferta cambió. Recargá la página para revisar el total antes de pagar.' } };
  }
  const first = buyer.firstName.trim();
  const last = buyer.lastName.trim();
  if (!first || !last) return { type: 'error', error: { message: 'Completá tu nombre y apellido.' } };
  const phoneNumber = buyer.phone.replace(/[ ()-]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) return { type: 'error', error: { message: 'Revisá el teléfono e incluí el código de país.' } };
  const named = await checkout.updateIndividualName(`${first} ${last}`);
  if (named.type === 'error') return named;
  onInitiate();
  return checkout.confirm({ email: buyer.email.trim(), phoneNumber });
}

import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js/pure';
import { CreditCard, LoaderCircle, UserRound } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText } from '@/lib/format.js';
import { trackPixel } from '@/lib/pixel.js';
import { Field, ErrorAlert } from '@/components/Field.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirmCheckout } from './confirmCheckout.js';

export const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
// Stripe.js is only loaded when a payment form is actually shown.
let stripe;
const appearance = { variables: { colorPrimary: '#075bd8', colorText: '#202a3b', borderRadius: '10px', fontFamily: 'Arial, sans-serif', fontSizeBase: '16px' } };

// Only email and name: card, wallets and anything else are Stripe's own Payment Element.
export function PersonalDetails({ buyer, setBuyer, disabled, formId }) {
  const field = (key, label, autocomplete, type, placeholder, hint) => <Field label={label} hint={hint}>{ids => <Input {...ids} form={formId} name={key} type={type} placeholder={placeholder} autoComplete={autocomplete} required maxLength={key === 'email' ? 254 : 100} value={buyer[key]} disabled={disabled} onChange={event => setBuyer(current => ({ ...current, [key]: event.target.value }))} />}</Field>;
  return <fieldset disabled={disabled} className="checkout-personal space-y-6">
    <legend className="mb-6 flex items-center gap-3 text-2xl font-bold"><UserRound aria-hidden="true" />Datos personales</legend>
    {field('email', 'Email *', 'email', 'email', 'tu@email.com', 'Te enviamos ahí el acceso a tu compra.')}
    {field('name', 'Nombre *', 'name', 'text', 'Tu nombre')}
  </fieldset>;
}

// No Link sign-up box and billing address only when the card really needs it.
const PAYMENT_ELEMENT_OPTIONS = { layout: 'tabs', wallets: { link: 'never' }, fields: { billingDetails: { address: 'if_required' } } };

function PaymentForm({ buyer, total, currency, totalLabel, onPayingChange, onInitiate, payRef }) {
  const state = useCheckoutElements();
  // Without buyer details (post-purchase) the email comes from the session; asked only if missing.
  const [email, setEmail] = useState('');
  const askEmail = !buyer && state.type === 'success' && !state.checkout.email;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const submitting = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current || state.type !== 'success' || !ready) return;
    submitting.current = true; setBusy(true); onPayingChange(true); setError('');
    try {
      const result = await confirmCheckout(state.checkout, buyer, { total, currency }, onInitiate, email);
      if (result.type === 'error') setError(result.error.message);
    } catch { setError('No pudimos confirmar el pago. Revisá tus datos y volvé a intentar.'); }
    finally { submitting.current = false; setBusy(false); onPayingChange(false); }
  }
  return <form id="checkout-payment" onSubmit={submit} className="space-y-6" aria-busy={busy}>
    <h2 className="flex items-center gap-3 text-2xl font-bold"><CreditCard aria-hidden="true" />Método de pago</h2>
    <ErrorAlert>{state.type === 'error' ? 'No pudimos cargar el pago seguro. Recargá la página para reintentar.' : error}</ErrorAlert>
    {askEmail && <Field label="Email *" hint="Te enviamos ahí el acceso a tu compra.">{ids => <Input {...ids} type="email" name="email" autoComplete="email" required maxLength={254} placeholder="tu@email.com" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />}</Field>}
    {state.type === 'success' && <PaymentElement options={PAYMENT_ELEMENT_OPTIONS} onReady={() => setReady(true)} onLoadError={() => setLoadError(true)} />}
    {loadError && <ErrorAlert>No se pudo cargar el medio de pago. Recargá la página para reintentar.</ErrorAlert>}
    {!ready && state.type !== 'error' && !loadError && <p role="status" className="text-sm text-muted-foreground">Cargando medios de pago…</p>}
    <Button ref={payRef} className="checkout-pay h-16 w-full text-lg" type="submit" disabled={busy || state.type !== 'success' || !ready || loadError}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Procesando…' : `Pagar ${totalLabel}`}</Button>
  </form>;
}

export default function CheckoutPayment({ view, via, selected, total, totalLabel, onPayingChange, payRef, origin, quizToken, initialBuyer }) {
  const start = useAction(api.checkout.start);
  // A quiz may hand over the name and email the visitor already typed; they stay editable.
  const [buyer, setBuyer] = useState(() => ({ email: typeof initialBuyer?.email === 'string' ? initialBuyer.email : '', name: typeof initialBuyer?.name === 'string' ? initialBuyer.name : '' }));
  const [paying, setPaying] = useState(false);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const attempts = useRef(new Map());
  const selection = JSON.stringify([...selected].sort());
  const key = `${origin}:${quizToken||''}:${view.subdomain}:${via}:${selection}:${total}:${view.store.currency}`;
  useEffect(() => {
    if (!stripeKey) return;
    let ignore = false;
    setError('');
    const timer = setTimeout(() => {
      let attempt = attempts.current.get(key);
      if (!attempt) { attempt = { id: crypto.randomUUID() }; attempts.current.set(key, attempt); }
      // Reuse the pending request/session for this selection, including retries and Strict Mode.
      // After a failure the retry asks for a fresh Stripe key: Stripe replays cached errors.
      attempt.promise ||= start({ subdomain: view.subdomain, via, upsellProductIds: JSON.parse(selection), attemptId: attempt.id, elements: true, origin, ...(quizToken?{quizToken}:{}), ...(attempt.failed ? { retry: true } : {}) }).catch(failure => { attempt.promise = null; attempt.failed = true; throw failure; });
      attempt.promise.then(result => { if (!ignore) setSession({ key, clientSecret: result.clientSecret }); }, failure => { if (!ignore) setError(errorText(failure, 'No pudimos cargar el pago. Volvé a intentar.')); });
    }, 250);
    return () => { ignore = true; clearTimeout(timer); };
  }, [key, selection, view.subdomain, via, start, retry, origin, quizToken]);
  const ready = session?.key === key;
  const setProcessing = value => { setPaying(value); onPayingChange(value); };
  if (stripeKey) stripe ||= loadStripe(stripeKey, { locale: 'es' });
  return <div className="space-y-9">
    <PersonalDetails buyer={buyer} setBuyer={setBuyer} disabled={paying} formId="checkout-payment" />
    {ready ? <CheckoutElementsProvider key={session.clientSecret} stripe={stripe} options={{ clientSecret: session.clientSecret, elementsOptions: { appearance }, adaptivePricing: { allowed: false } }}>
      <PaymentForm total={total} currency={view.store.currency} buyer={buyer} totalLabel={totalLabel} onPayingChange={setProcessing} payRef={payRef} onInitiate={() => trackPixel(view.store.metaPixelId, 'InitiateCheckout', { value: total / 100, currency: view.store.currency })} />
    </CheckoutElementsProvider> : <div className="space-y-6">
      <h2 className="flex items-center gap-3 text-2xl font-bold"><CreditCard aria-hidden="true" />Método de pago</h2>
      <ErrorAlert>{error}</ErrorAlert>
      <p className="text-sm text-muted-foreground" role="status">{!stripeKey ? 'Los pagos todavía no están habilitados en este sitio.' : !error ? 'Cargando medios de pago seguros…' : ''}</p>
      {error && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>Reintentar</Button>}
      <Button className="checkout-pay h-16 w-full text-lg" disabled>Pagar {totalLabel}</Button>
    </div>}
  </div>;
}

// Payment Element for a session that was already created (downsell and post-purchase offers).
// `askContact` shows the personal details form; without it the session already knows the buyer.
export function SessionPayment({ clientSecret, total, currency, totalLabel, askContact = false, onInitiate = () => {}, onPayingChange = () => {} }) {
  const [buyer, setBuyer] = useState({ email: '', name: '' });
  const [paying, setPayingState] = useState(false);
  const setPaying = value => { setPayingState(value); onPayingChange(value); };
  if (stripeKey) stripe ||= loadStripe(stripeKey, { locale: 'es' });
  return <div className="space-y-8 rounded-xl border bg-card p-5 sm:p-6">
    {askContact && <PersonalDetails buyer={buyer} setBuyer={setBuyer} disabled={paying} formId="checkout-payment" />}
    <CheckoutElementsProvider key={clientSecret} stripe={stripe} options={{ clientSecret, elementsOptions: { appearance }, adaptivePricing: { allowed: false } }}>
      <PaymentForm total={total} currency={currency} buyer={askContact ? buyer : null} totalLabel={totalLabel} onPayingChange={setPaying} onInitiate={onInitiate} />
    </CheckoutElementsProvider>
  </div>;
}

import { CHECKOUT_DEFAULTS, checkoutConfig, checkoutText } from '../../shared/checkout-copy.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js/pure';
import { Clock, CreditCard, LoaderCircle, UserRound } from 'lucide-react';
import { api } from '@/lib/api.js';
import { trackPixel } from '@/lib/pixel.js';
import { Field, ErrorAlert } from '@/components/Field.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sessionDeadline, sessionEnded, sessionTimeLeft } from '../../shared/checkout-session.js';
import { confirmCheckout } from './confirmCheckout.js';
import { attributionArgs } from './attribution.js';

export const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
// Stripe.js is only loaded when a payment form is actually shown.
const stripeInstances = new Map();
const stripeFor = locale => {
  if (!stripeInstances.has(locale)) stripeInstances.set(locale, loadStripe(stripeKey, { locale }));
  return stripeInstances.get(locale);
};
const appearance = { variables: { colorPrimary: '#075bd8', colorText: '#202a3b', borderRadius: '10px', fontFamily: 'Arial, sans-serif', fontSizeBase: '16px' } };

// Only email and name: card, wallets and anything else are Stripe's own Payment Element.
export function PersonalDetails({ buyer, setBuyer, disabled, formId, onBlur, copy = CHECKOUT_DEFAULTS }) {
  const field = (key, label, autocomplete, type, placeholder, hint) => <Field label={label} hint={hint}>{ids => <Input {...ids} form={formId} name={key} type={type} placeholder={placeholder} autoComplete={autocomplete} required maxLength={key === 'email' ? 254 : 100} value={buyer[key]} disabled={disabled} onChange={event => setBuyer(current => ({ ...current, [key]: event.target.value }))} />}</Field>;
  return <fieldset disabled={disabled} onBlur={onBlur} className="checkout-personal space-y-3">
    <legend className="mb-6 flex items-center gap-3 text-2xl font-bold"><UserRound aria-hidden="true" />{copy.personalTitle}</legend>
    <div className="grid gap-5 sm:grid-cols-2">
      {field('email', copy.emailLabel, 'email', 'email', copy.emailPlaceholder)}
      {field('name', copy.nameLabel, 'name', 'text', copy.namePlaceholder)}
    </div>
    <p className="text-sm text-muted-foreground">{copy.emailHint}</p>
  </fieldset>;
}

// Contact known before the form (from the quiz) fills only the fields still empty, also
// when it arrives after the form was shown. What the buyer already typed is kept.
function useBuyer(initialBuyer) {
  const [buyer, setBuyer] = useState({ email: '', name: '' });
  const email = typeof initialBuyer?.email === 'string' ? initialBuyer.email : '';
  const name = typeof initialBuyer?.name === 'string' ? initialBuyer.name : '';
  useEffect(() => {
    if (email || name) setBuyer(current => ({ email: current.email || email, name: current.name || name }));
  }, [email, name]);
  return [buyer, setBuyer];
}

// Keeps what the visitor typed on the pending order of `sessionId`, so a checkout abandoned
// before paying still has its contact. Saved shortly after typing stops (autofill included)
// and when the fields lose focus; the server ignores anything that is not an email.
const DRAFT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function useBuyerDraft(sessionId, buyer) {
  const save = useMutation(api.checkout.saveBuyerDraft);
  const latest = useRef({ sessionId, buyer });
  latest.current = { sessionId, buyer };
  const sent = useRef('');
  const flush = useCallback(() => {
    const { sessionId: id, buyer: current } = latest.current;
    const email = current.email.trim();
    const name = current.name.trim();
    if (!id || !DRAFT_EMAIL.test(email)) return;
    const key = JSON.stringify([id, email, name]);
    if (key === sent.current) return;
    sent.current = key;
    save({ sessionId: id, email, name }).catch(() => { if (sent.current === key) sent.current = ''; });
  }, [save]);
  useEffect(() => {
    const timer = setTimeout(flush, 800);
    return () => clearTimeout(timer);
  }, [sessionId, buyer.email, buyer.name, flush]);
  return flush;
}

// Countdown to the real end of a Stripe session ({ sessionId, expiresAt }) and whether it can
// still be paid. It ends at the deadline, or earlier when the webhook reports it expired.
export function useSessionClock(session) {
  const deadline = sessionDeadline(session?.expiresAt);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, [deadline]);
  const status = useQuery(api.checkout.sessionStatus, session?.sessionId ? { sessionId: session.sessionId } : 'skip');
  if (!session) return { timeLeft: null, ended: false };
  return { timeLeft: deadline === null ? null : sessionTimeLeft(deadline, now), ended: status === 'ended' || (deadline !== null && now >= deadline) };
}

// Shown instead of the card form once the session can no longer be paid.
function SessionExpired({ copy, onRenew, heading = true }) {
  return <div className="space-y-6">
    {heading && <h2 className="flex items-center gap-3 text-2xl font-bold"><CreditCard aria-hidden="true" />{copy.paymentTitle}</h2>}
    <Alert role="alert"><Clock aria-hidden="true" /><AlertDescription>{copy.expiredError}</AlertDescription></Alert>
    <Button type="button" className="checkout-pay h-16 w-full text-lg" onClick={onRenew}>{copy.renew}</Button>
  </div>;
}

// No Link sign-up box and billing address only when the card really needs it.
const PAYMENT_ELEMENT_OPTIONS = { layout: 'tabs', wallets: { link: 'never' }, fields: { billingDetails: { address: 'if_required' } } };

function PaymentForm({ buyer, total, currency, totalLabel, onPayingChange, onInitiate, payRef, copy = CHECKOUT_DEFAULTS }) {
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
      const result = await confirmCheckout(state.checkout, buyer, { total, currency }, onInitiate, email, copy);
      if (result.type === 'error') setError(result.error.message);
    } catch { setError(copy.confirmError); }
    finally { submitting.current = false; setBusy(false); onPayingChange(false); }
  }
  return <form id="checkout-payment" onSubmit={submit} className="space-y-6" aria-busy={busy}>
    <h2 className="flex items-center gap-3 text-2xl font-bold"><CreditCard aria-hidden="true" />{copy.paymentTitle}</h2>
    <ErrorAlert>{state.type === 'error' ? copy.loadError : error}</ErrorAlert>
    {askEmail && <Field label={copy.emailLabel} hint={copy.emailHint}>{ids => <Input {...ids} type="email" name="email" autoComplete="email" required maxLength={254} placeholder={copy.emailPlaceholder} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />}</Field>}
    {state.type === 'success' && <PaymentElement options={PAYMENT_ELEMENT_OPTIONS} onReady={() => setReady(true)} onLoadError={() => setLoadError(true)} />}
    {loadError && <ErrorAlert>{copy.methodError}</ErrorAlert>}
    {!ready && state.type !== 'error' && !loadError && <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p>}
    <Button ref={payRef} className="checkout-pay h-16 w-full text-lg" type="submit" disabled={busy || state.type !== 'success' || !ready || loadError}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? copy.processing : checkoutText(copy, 'pay', { importe: totalLabel })}</Button>
  </form>;
}

export default function CheckoutPayment({ view, via, selected, total, totalLabel, onPayingChange, payRef, origin, quizToken, initialBuyer, onSession }) {
  const copy = checkoutConfig(view);
  const start = useAction(api.checkout.start);
  // A quiz may hand over the name and email the visitor already typed; they stay editable.
  const [buyer, setBuyer] = useBuyer(initialBuyer);
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
      // Coming back to a selection whose session already ran out starts a new order.
      if (attempt && sessionEnded(attempt.expiresAt)) attempt = null;
      if (!attempt) { attempt = { id: crypto.randomUUID() }; attempts.current.set(key, attempt); }
      // Reuse the pending request/session for this selection, including retries and Strict Mode.
      // After a failure the retry asks for a fresh Stripe key: Stripe replays cached errors.
      attempt.promise ||= start({ subdomain: view.subdomain, via, upsellProductIds: JSON.parse(selection), attemptId: attempt.id, elements: true, origin, ...attributionArgs(view.subdomain), ...(quizToken?{quizToken}:{}), ...(attempt.failed ? { retry: true } : {}) }).catch(failure => { attempt.promise = null; attempt.failed = true; throw failure; });
      attempt.promise.then(result => { attempt.expiresAt = result.expiresAt; if (!ignore) setSession({ key, clientSecret: result.clientSecret, sessionId: result.sessionId, expiresAt: result.expiresAt }); }, () => { if (!ignore) setError(copy.sessionError); });
    }, 250);
    return () => { ignore = true; clearTimeout(timer); };
  }, [key, selection, view.subdomain, via, start, retry, origin, quizToken, copy.sessionError]);
  const ready = session?.key === key;
  const live = ready ? session : null;
  const clock = useSessionClock(live);
  const saveDraft = useBuyerDraft(live?.sessionId, buyer);
  // The page shows the countdown next to the order summary.
  useEffect(() => { onSession?.(live ? { sessionId: live.sessionId, expiresAt: live.expiresAt } : null); }, [live?.sessionId, live?.expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // A new attempt is a new order and a new Stripe session; the expired one stays expired.
  function renew() { attempts.current.delete(key); setSession(null); setRetry(value => value + 1); }
  const setProcessing = value => { setPaying(value); onPayingChange(value); };
  const stripe = stripeKey ? stripeFor(copy.paymentLocale) : null;
  return <div className="space-y-9">
    <PersonalDetails buyer={buyer} setBuyer={setBuyer} disabled={paying} formId="checkout-payment" onBlur={saveDraft} copy={copy} />
    {ready && clock.ended && !paying ? <SessionExpired copy={copy} onRenew={renew} /> : ready ? <CheckoutElementsProvider key={`${session.clientSecret}:${copy.paymentLocale}`} stripe={stripe} options={{ clientSecret: session.clientSecret, elementsOptions: { appearance }, adaptivePricing: { allowed: false } }}>
      <PaymentForm copy={copy} total={total} currency={view.store.currency} buyer={buyer} totalLabel={totalLabel} onPayingChange={setProcessing} payRef={payRef} onInitiate={() => trackPixel(view.store.metaPixelId, 'InitiateCheckout', { value: total / 100, currency: view.store.currency })} />
    </CheckoutElementsProvider> : <div className="space-y-6">
      <h2 className="flex items-center gap-3 text-2xl font-bold"><CreditCard aria-hidden="true" />{copy.paymentTitle}</h2>
      <ErrorAlert>{error}</ErrorAlert>
      <p className="text-sm text-muted-foreground" role="status">{!stripeKey ? copy.unavailable : !error ? copy.loadingSecure : ''}</p>
      {error && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>{copy.retry}</Button>}
      <Button className="checkout-pay h-16 w-full text-lg" disabled>{checkoutText(copy, 'pay', { importe: totalLabel })}</Button>
    </div>}
  </div>;
}

// Payment Element for a session that was already created (downsell and post-purchase offers).
// `askContact` shows the personal details form; without it the session already knows the buyer.
// With `sessionId`, `expiresAt` and `onRenew`, an expired session is replaced by a button that
// asks the page for a new one.
export function SessionPayment({ clientSecret, sessionId, expiresAt, onRenew, total, currency, totalLabel, askContact = false, initialBuyer, onInitiate = () => {}, onPayingChange = () => {}, copy = CHECKOUT_DEFAULTS }) {
  const [buyer, setBuyer] = useBuyer(initialBuyer);
  const [paying, setPayingState] = useState(false);
  const clock = useSessionClock(sessionId ? { sessionId, expiresAt } : null);
  // Only where this form asks for the contact; otherwise the session already has it.
  const saveDraft = useBuyerDraft(askContact ? sessionId : undefined, buyer);
  const ended = Boolean(onRenew) && clock.ended && !paying;
  const setPaying = value => { setPayingState(value); onPayingChange(value); };
  const stripe = stripeKey ? stripeFor(copy.paymentLocale) : null;
  return <div className="space-y-8 rounded-xl border bg-card p-5 sm:p-6">
    {askContact && <PersonalDetails buyer={buyer} setBuyer={setBuyer} disabled={paying} formId="checkout-payment" onBlur={saveDraft} copy={copy} />}
    {ended ? <SessionExpired copy={copy} onRenew={onRenew} heading={false} /> : <CheckoutElementsProvider key={clientSecret} stripe={stripe} options={{ clientSecret, elementsOptions: { appearance }, adaptivePricing: { allowed: false } }}>
      <PaymentForm copy={copy} total={total} currency={currency} buyer={askContact ? buyer : null} totalLabel={totalLabel} onPayingChange={setPaying} onInitiate={onInitiate} />
    </CheckoutElementsProvider>}
  </div>;
}

// The preview mounts no Stripe provider, creates no orders and sends no analytics.
export function CheckoutPaymentPreview({ copy, totalLabel, state = 'ready', askContact = true }) {
  const [buyer, setBuyer] = useState({ email: '', name: '' });
  const paymentLabels = { es: ['Tarjeta', 'Número de tarjeta', 'Vencimiento', 'Código de seguridad'], en: ['Card', 'Card number', 'Expiration date', 'Security code'], pt: ['Cartão', 'Número do cartão', 'Validade', 'Código de segurança'] }[copy.paymentLocale] ?? ['Card', 'Card number', 'Expiration date', 'Security code'];
  const messages = { loading: copy.loading, loadingSecure: copy.loadingSecure, unavailable: copy.unavailable, error: copy.confirmError, loadError: copy.loadError, methodError: copy.methodError, sessionError: copy.sessionError, changedError: copy.changedError, emailError: copy.emailError, nameError: copy.nameError };
  return <div className="space-y-9">
    {askContact && <PersonalDetails buyer={buyer} setBuyer={setBuyer} copy={copy} disabled={state === 'processing'} />}
    <section className="space-y-6">
      <h2 className="flex items-center gap-3 text-2xl font-bold"><CreditCard aria-hidden="true" />{copy.paymentTitle}</h2>
      {messages[state] && (['loading', 'loadingSecure', 'unavailable'].includes(state) ? <p role="status" className="text-sm text-muted-foreground">{messages[state]}</p> : <ErrorAlert>{messages[state]}</ErrorAlert>)}
      {state === 'sessionError' && <Button type="button" variant="outline">{copy.retry}</Button>}
      <div className="space-y-4 rounded-xl border p-4">
        <p className="flex items-center gap-2 text-sm font-medium"><CreditCard aria-hidden="true" />{paymentLabels[0]}</p>
        <Field label={paymentLabels[1]}>{ids => <Input {...ids} disabled placeholder="1234 1234 1234 1234" />}</Field>
        <div className="grid grid-cols-2 gap-3">{paymentLabels.slice(2).map((label, index) => <Field key={label} label={label}>{ids => <Input {...ids} disabled placeholder={index === 0 ? (['pt', 'es'].includes(copy.paymentLocale) ? 'MM / AA' : 'MM / YY') : 'CVC'} />}</Field>)}</div>
        <p className="text-xs leading-5 text-muted-foreground">Preview only. Stripe shows the payment methods available to each customer.</p>
      </div>
      <Button className="checkout-pay h-auto min-h-16 w-full whitespace-normal text-lg" type="button" disabled>{state === 'processing' ? copy.processing : checkoutText(copy, 'pay', { importe: totalLabel })}</Button>
    </section>
  </div>;
}

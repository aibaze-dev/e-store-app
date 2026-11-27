import { postLabels, backPopupConfig, purchaseText } from '../../shared/purchase-copy.js';
import { checkoutConfig, checkoutText } from '../../shared/checkout-copy.js';
import { viewLanguage } from '../../shared/landing-copy.js';
import { readQuizToken } from './quiz-session.js';
import { PurchaseResult, Video } from '@/templates/PostPurchaseContent.jsx';
import { videoSource } from '../../shared/post-purchase.js';
import { classicTheme } from '../../shared/classic-design.js';
import PostPurchaseModal from './PostPurchaseModal.jsx';
import PurchaseCelebration from './PurchaseCelebration.jsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAction, useQuery } from 'convex/react';
import { Check, Gift, LoaderCircle, LockKeyhole, Plus, ShieldCheck, Zap } from 'lucide-react';
import { api } from '@/lib/api.js';
import { majorAmount, storefrontMoney as formatMoney } from '@/lib/storefront-money.js';
import { trackPixel, trackPixelOnce } from '@/lib/pixel.js';
import { checkoutTotals, normalizeContent, productDiscount } from '@/templates/content.js';
import DemoPurchaseToasts from './DemoPurchaseToasts.jsx';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ErrorAlert } from '@/components/Field.jsx';
import ExitIntentModal from './ExitIntentModal.jsx';
import CheckoutPayment, { CheckoutPaymentPreview, SessionPayment, stripeKey, useSessionClock } from './CheckoutPayment.jsx';
import PostPurchaseOfferCard from '@/templates/PostPurchaseOfferCard.jsx';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckoutActivityBar, CheckoutOfferTimer, useSimulatedCheckoutSignals } from './CheckoutSignals.jsx';
import { useStorePresence } from './useStorePresence.js';
import { useViewTracking } from './useViewTracking.js';
import { useQuizContact } from './useQuizContact.js';
import { attributionArgs } from './attribution.js';

// Everything after the landing: checkout, downsell offer and thank-you page. Storefront.jsx
// loads this file on demand, so a landing visit does not download the payment screens.

// One checkout attempt per selection: retrying the same selection reuses the same order.
// `failed` asks the server for a fresh Stripe key, since Stripe replays a cached failure.
// `fresh` starts over after the session expired: that order can no longer be paid.
function useAttempt() {
  const attempt = useRef({ key: null, id: '', failed: false });
  return (key, fresh = false) => {
    if (fresh || attempt.current.key !== key) attempt.current = { key, id: crypto.randomUUID(), failed: false };
    return attempt.current;
  };
}
const attemptArgs = attempt => ({ attemptId: attempt.id, ...(attempt.failed ? { retry: true } : {}) });

function Thumb({ src, name, className = 'size-16' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img src={src} alt="" className={`${className} shrink-0 rounded-lg object-cover`} onError={() => setFailed(true)} />;
  return <span className={`${className} checkout-thumb shrink-0 rounded-lg bg-foreground text-background`} title={name}><span aria-hidden="true">📖</span>{className.includes('h-20') && <small>{name}</small>}</span>;
}

// What a line of the order costs, the same way in the summary and in the extras: the reference
// price crossed out, the price in green and the discount in red. A bonus shows the free badge.
const DISCOUNT_BADGE = 'rounded bg-destructive/10 px-1.5 py-0.5 font-bold whitespace-nowrap text-destructive';
function LinePrices({ price, reference = 0, money, discountLabel, freeLabel, prefix = '' }) {
  const percent = freeLabel ? 0 : productDiscount(price, reference);
  return <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
    {reference > (freeLabel ? 0 : price) && <del className="text-muted-foreground">{money(reference)}</del>}
    {freeLabel ? <Badge>{freeLabel}</Badge> : <strong className="checkout-positive text-sm">{prefix}{money(price)}</strong>}
    {percent > 0 && <span className={DISCOUNT_BADGE}>{discountLabel(percent)}</span>}
  </p>;
}

export function Checkout({ view, via }) {
  const location = useLocation();
  const origin=location.state?.origin || 'direct';
  useStorePresence(view.subdomain, 'checkout');
  useViewTracking(view.subdomain, 'checkout', view.store.id, origin);

  // The quiz already asked for name and email: the navigation brings them, the server keeps them on reload.
  const quizContact = useQuizContact(view.subdomain);
  return <CheckoutView view={view} via={via} initialBuyer={location.state?.buyer ?? quizContact ?? undefined} />;
}

export function CheckoutView({ view, via, initialBuyer, preview = false, previewState = 'ready' }) {
  const location = useLocation();
  const origin = preview ? 'direct' : location.state?.origin || 'direct';
  const { shoppers } = useSimulatedCheckoutSignals(view.subdomain, { preview });
  // The countdown is the real life of the Stripe session; it appears once the session exists.
  const [session, setSession] = useState(null);
  const sessionClock = useSessionClock(preview ? null : session);
  const timeLeft = preview ? '29:37' : sessionClock.timeLeft;
  const copy = checkoutConfig(view);
  const t = (key, values) => checkoutText(copy, key, values);
  const { offer, store } = view;
  // Extras ticked in the landing's order builder arrive already selected.
  const [selected, setSelected] = useState(() => offer.upsells.filter(upsell => (!preview && location.state?.selected?.includes(upsell.productId))).map(upsell => upsell.productId));
  const [busy, setBusy] = useState(false);
  const content = normalizeContent(view.content);
  const money = amount => formatMoney(amount, store.currency);
  const navigate = useNavigate();
  const focusHeading = !preview && location.state?.focusHeading;
  const headingRef = useRef(null);
  const payRef = useRef(null);
  useLayoutEffect(() => {
    const viewport = headingRef.current.ownerDocument.defaultView;
    const scrollToTop = () => viewport.scrollTo({ top: 0, behavior: 'instant' });
    if (focusHeading) headingRef.current.focus({ preventScroll: true });
    scrollToTop();
    // History navigation can restore the old offset after React commits.
    let frame = viewport.requestAnimationFrame(scrollToTop);
    const onPageShow = () => {
      viewport.cancelAnimationFrame(frame);
      frame = viewport.requestAnimationFrame(scrollToTop);
    };
    viewport.addEventListener('pageshow', onPageShow);
    return () => {
      viewport.cancelAnimationFrame(frame);
      viewport.removeEventListener('pageshow', onPageShow);
    };
  }, [location.key, view.subdomain, focusHeading]);
  // Sends the visitor back to the step they were on; it never starts the payment.
  const exitIntent = <ExitIntentModal view={view} step="checkout" disabled={busy} onOffer={view.downsell ? () => navigate('../oferta', { state: { origin } }) : undefined} onCta={() => {
    const target = payRef.current && !payRef.current.disabled ? payRef.current : headingRef.current;
    target?.scrollIntoView({ block: 'center' });
    target?.focus();
  }} />;
  const chosen = offer.upsells.filter(upsell => selected.includes(upsell.productId));
  // Shown amounts only; the server recalculates the charge from the store.
  const { total, reference, savings } = checkoutTotals(offer, chosen);
  const discountLabel = percent => t('discount', { porcentaje: percent });
  const locked = busy || (preview && previewState === 'processing');
  const guarantee = copy.showGuarantee && content.guarantee.enabled && content.guarantee.text ? (content.guarantee.days ? t('guarantee', { dias: content.guarantee.days }) : copy.guaranteeFallback) : '';
  const trust = copy.showTrust && <p className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
    <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5" aria-hidden="true" />{copy.secure}</span>
    {guarantee && <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" aria-hidden="true" />{guarantee}</span>}
  </p>;

  return <div className="checkout-page min-h-screen bg-muted/40" style={classicTheme(content.style?.accentColor)}>
    <header className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-4 text-sm font-semibold sm:px-6">
      <LockKeyhole className="size-4 text-primary" aria-hidden="true" />{copy.secure}
      <Link onClick={event => { if (preview) event.preventDefault(); }} to={origin==='quiz'?'../quiz/resultado':'..'} className="ml-auto font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground">{copy.back}</Link>
    </div></header>
    {copy.showActivity && <CheckoutActivityBar shoppers={shoppers} copy={copy} />}
    <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">{copy.title}</h1>
      <aside className="checkout-sidebar min-w-0 space-y-3 lg:col-start-2 lg:row-start-1">
        <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="checkout-summary">
          <h2 id="checkout-summary" className="border-b px-4 py-3 font-semibold">{copy.summaryTitle}</h2>
          <div className="space-y-4 p-4">
            {/* Every product of the order as a card, like the extras: cover, name, prices and discount. */}
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Thumb src={offer.main.coverUrl} name={offer.main.name} className="h-20 w-16" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <h3 className="leading-snug font-semibold">{offer.main.name}</h3>
                  <LinePrices price={offer.main.price} reference={offer.main.compareAtPrice} money={money} discountLabel={discountLabel} />
                  {offer.bonuses.length > 0 && <Badge variant="secondary"><Gift aria-hidden="true" />{t(offer.bonuses.length === 1 ? 'oneBonus' : 'manyBonuses', { cantidad: offer.bonuses.length })}</Badge>}
                </div>
              </li>
              {offer.bonuses.map(bonus => <li key={bonus.productId} className="flex items-center gap-3">
                <Thumb src={bonus.coverUrl} name={bonus.name} className="size-12" />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-sm leading-snug font-semibold">{bonus.name}</h3>
                  <LinePrices reference={bonus.referenceValue} freeLabel={copy.free} money={money} />
                </div>
              </li>)}
              {chosen.map(upsell => <li key={upsell.productId} className="flex items-center gap-3">
                <Thumb src={upsell.coverUrl} name={upsell.name} className="size-12" />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-sm leading-snug font-semibold">{upsell.name}</h3>
                  <LinePrices price={upsell.price} reference={upsell.compareAtPrice} money={money} discountLabel={discountLabel} prefix="+ " />
                </div>
              </li>)}
            </ul>
            <div className="space-y-3 border-t pt-4" aria-live="polite">
              <div className="flex items-end justify-between gap-4"><span className="text-muted-foreground">{copy.total}</span>
                <span className="grid justify-items-end gap-1 text-right">
                  {savings > 0 && <span className="flex flex-wrap items-center justify-end gap-2 text-sm"><del className="text-muted-foreground">{money(reference)}</del><span className={`${DISCOUNT_BADGE} text-xs`}>{discountLabel(productDiscount(total, reference))}</span></span>}
                  <strong className="checkout-positive text-2xl font-semibold">{money(total)}</strong>
                </span></div>
              {savings > 0 && <p className="checkout-savings rounded-lg px-3 py-2 text-center text-sm font-semibold">{t('savings', { importe: money(savings) })}</p>}
            </div>
          </div>
          <div className="border-t bg-muted/40 p-4">{trust}</div>
        </section>

        {offer.upsells.length > 0 ? <section className="space-y-2 rounded-xl border bg-card p-3" aria-labelledby="checkout-extras">
          <h2 id="checkout-extras" className="flex items-center gap-2 text-sm font-semibold"><Zap className="size-4 shrink-0 text-primary" aria-hidden="true" />{copy.upsellTitle}</h2>
          <CheckoutOfferTimer timeLeft={copy.showTimer ? timeLeft : null} label={view.content?.promotion?.timerLabel} />
          {offer.upsells.map(upsell => {
            const on = selected.includes(upsell.productId);
            return <article key={upsell.productId} className={`relative flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${on ? 'checkout-extra-selected' : 'border-border'}`}>
              <Thumb src={upsell.coverUrl} name={upsell.name} className="size-10" />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-sm leading-snug font-semibold">{upsell.name}</h3>
                <LinePrices price={upsell.price} reference={upsell.compareAtPrice} money={money} discountLabel={discountLabel} prefix="+ " />
                {(upsell.shortDescription || upsell.description) && <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">{upsell.shortDescription || upsell.description}</p>}
                <button type="button" className="checkout-extra-button inline-flex items-center gap-1 text-left text-xs font-semibold" aria-label={`${on ? copy.added : copy.add} · ${upsell.name}`} aria-pressed={on} disabled={locked}
                  onClick={() => setSelected(on ? selected.filter(id => id !== upsell.productId) : [...selected, upsell.productId])}>
                  {on ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}{on ? copy.added : copy.add}
                </button>
              </div>
            </article>;
          })}
        </section> : <CheckoutOfferTimer timeLeft={copy.showTimer ? timeLeft : null} label={view.content?.promotion?.timerLabel} />}
      </aside>
      <section className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1">
        {preview ? <CheckoutPaymentPreview copy={copy} totalLabel={money(total)} state={previewState} /> : <CheckoutPayment origin={origin} quizToken={origin==='quiz'?readQuizToken(view.subdomain):undefined} initialBuyer={initialBuyer} view={view} via={via} selected={selected} total={total} totalLabel={money(total)} onPayingChange={setBusy} payRef={payRef} onSession={setSession} />}
        {trust}
      </section>
    </main>
    {copy.notifications && <DemoPurchaseToasts key={view.subdomain} copy={copy} preview={preview} checkoutCopy={copy} placement="bottom" region={content.activity.noticeRegion} language={viewLanguage(view)} />}
    {(content.footer.termsUrl || content.footer.privacyUrl) && <nav className="checkout-legal" aria-label={copy.legalLabel}>
      {content.footer.privacyUrl && <a onClick={event => { if (preview) event.preventDefault(); }} href={content.footer.privacyUrl} target="_blank" rel="noreferrer">{copy.privacy}</a>}
      {content.footer.termsUrl && <a onClick={event => { if (preview) event.preventDefault(); }} href={content.footer.termsUrl} target="_blank" rel="noreferrer">{copy.terms}</a>}
    </nav>}
    {!preview && exitIntent}
  </div>;
}

// The downsell: the main product with its bonuses and without extras, at the store's
// discount. The amounts shown come from the server, which charges the same ones.
export function DownsellOffer({ view, via }) {
  useStorePresence(view.subdomain, 'offer');
  const origin=useLocation().state?.origin || 'direct';
  useViewTracking(view.subdomain, 'checkout', view.store.id, origin);
  const quizContact = useQuizContact(view.subdomain);
  const start = useAction(api.checkout.start);
  const attemptFor = useAttempt();
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { offer, store, downsell } = view;
  useEffect(() => { document.title = offer.main.name; }, [offer.main.name]);

  async function pay(final, fresh = false) {
    if (busy) return;
    setBusy(true); setError('');
    if (fresh) setPayment(null);
    const attempt = attemptFor(final ? 'final' : 'downsell', fresh);
    try {
      const result = await start({ subdomain: view.subdomain, upsellProductIds: [], ...attemptArgs(attempt), via, downsell: true, finalDownsell: final, elements: true, origin, ...attributionArgs(view.subdomain), ...(origin==='quiz'?{quizToken:readQuizToken(view.subdomain)}:{}) });
      trackPixel(store.metaPixelIds, 'InitiateCheckout', { value: majorAmount(final ? downsell.finalPrice : downsell.price, store.currency), currency: store.currency });
      setPayment(result);
    } catch (failure) { attempt.failed = true; setError(postLabels(view.content).startError); }
    finally { setBusy(false); }
  }

  return <DownsellOfferView view={view} origin={origin} payment={payment} busy={busy} error={error} onPay={pay} initialBuyer={quizContact ?? undefined} />;
}

export function DownsellOfferView({ view, origin = 'direct', payment, busy = false, error = '', onPay, initialBuyer, preview = false, previewFinal = false }) {
  const { offer, store, downsell } = view;
  const copy = backPopupConfig(view);
  const checkout = checkoutConfig(view);
  const labels = postLabels(view.content);
  const money = amount => formatMoney(amount, store.currency);
  const { timeLeft } = useSimulatedCheckoutSignals(`${view.subdomain}:oferta`, { preview });
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [finalOpen, setFinalOpen] = useState(previewFinal);
  const [useFinal, setUseFinal] = useState(false);
  if (!downsell) return <p className="p-6">Activá el descuento del producto principal para ver esta oferta. No se inventa un precio en la vista previa.</p>;
  const price = useFinal ? downsell.finalPrice : downsell.price;
  const percent = useFinal ? downsell.finalPercent : downsell.percent;
  const canImprove = downsell.finalPrice < downsell.price;
  const leave = () => {
    setFinalOpen(false);
    if (!preview) navigate(origin === 'quiz' ? '../quiz/resultado' : '..');
  };
  function accept(final) {
    setUseFinal(final);
    setFinalOpen(false);
    if (preview) setAccepted(true);
    else onPay(final);
  }
  const finalCard = <PostPurchaseOfferCard
    offer={{ ...offer.main, finalPrice: downsell.finalPrice, finalPercent: downsell.finalPercent,
      content: { postOptions: { showPaymentNote: false }, postPurchase: {
        finalText: `Your discount goes from ${downsell.percent}% to ${downsell.finalPercent}% on ${offer.main.name}.`,
      } } }}
    currency={store.currency} stage="final" preview={preview} canPurchase={preview || Boolean(stripeKey)}
    Title={preview ? undefined : DialogTitle} Description={preview ? undefined : DialogDescription}
    onAccept={() => accept(true)} onDecline={leave} />;
  const theme = classicTheme(view.content?.style?.accentColor);
  return <div className="offer-page min-h-screen bg-muted/40 break-words" style={theme}>
    <header className="border-b bg-card"><div className="mx-auto flex max-w-xl items-center gap-2 px-5 py-4 text-sm font-semibold sm:px-6">
      <LockKeyhole className="size-4 text-primary" aria-hidden="true" />{checkout.secure}
      <Link onClick={event => { if (preview) event.preventDefault(); }} to={origin==='quiz'?'../quiz/resultado':'..'} className="ml-auto font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground">{checkout.back}</Link>
    </div></header>
    <main className="mx-auto max-w-xl space-y-6 px-5 py-8 sm:px-6">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.pageTitle}</h1>
        <p className="leading-7 text-muted-foreground">{copy.pageSubtitle}</p>
      </div>
      {downsell.videoUrl && videoSource(downsell.videoUrl) && <Video key={downsell.videoUrl} video={{ enabled: true, url: downsell.videoUrl, title: '' }} autoPlay={!preview} editKey="popupBack" labels={labels} preview={preview} />}
      <CheckoutOfferTimer timeLeft={checkout.showTimer ? timeLeft : null} label={view.content?.promotion?.timerLabel} />
      <section className="overflow-hidden rounded-xl border bg-card" aria-label={copy.offerLabel}>
        <div className="space-y-4 p-5">
          <div className="flex gap-4">
            <Thumb src={offer.main.coverUrl} name={offer.main.name} className="h-24 w-20" />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="leading-snug font-semibold">{offer.main.name}</h2>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <del className="text-sm text-muted-foreground">{money(offer.main.price)}</del>
                <strong className="text-xl text-primary">{money(price)}</strong>
                <span className="text-sm font-semibold text-primary">{purchaseText(copy, 'savings', { porcentaje: percent })}</span>
              </p>
              {(offer.main.shortDescription || offer.main.description) && <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{offer.main.shortDescription || offer.main.description}</p>}
            </div>
          </div>
          {offer.bonuses.length > 0 && <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><Gift className="size-4 text-primary" aria-hidden="true" />{copy.bonuses}</p>
            <ul className="space-y-2">{offer.bonuses.map(bonus => <li key={bonus.productId} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{bonus.name}</span>{bonus.referenceValue > 0 && <del className="whitespace-nowrap">{money(bonus.referenceValue)}</del>}<Badge>{checkout.free}</Badge>
            </li>)}</ul>
          </div>}
          {(payment || accepted) && <p role="status" className="text-sm font-semibold checkout-positive">Promo code applied · ATENEO_DISC</p>}
          <dl className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{copy.subtotal}</dt><dd>{money(offer.main.price)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{copy.discount}</dt><dd className="font-semibold text-primary">-{money(offer.main.price - price)}</dd></div>
            <div className="flex items-end justify-between gap-4"><dt className="text-muted-foreground">{checkout.total}</dt><dd className="text-2xl font-semibold">{money(price)}</dd></div>
          </dl>
        </div>
      </section>
      {preview && accepted ? <CheckoutPaymentPreview copy={checkout} totalLabel={money(price)} /> : payment ? <SessionPayment copy={checkout} key={payment.clientSecret} clientSecret={payment.clientSecret} sessionId={payment.sessionId} expiresAt={payment.expiresAt} onRenew={() => onPay(useFinal, true)} total={price} currency={store.currency} totalLabel={money(price)} askContact initialBuyer={initialBuyer} /> : <div className="space-y-3">
        {!preview && !stripeKey && <Alert><AlertDescription>{checkout.unavailable}</AlertDescription></Alert>}
        <ErrorAlert>{error}</ErrorAlert>
        <Button size="lg" className="h-auto min-h-14 w-full whitespace-normal py-3 text-base" onClick={() => accept(useFinal)} disabled={busy || (!preview && !stripeKey)}>
          {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? labels.preparing : copy.cta}
        </Button>
        <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={canImprove && !useFinal ? () => setFinalOpen(true) : leave}>I’m not ready yet</Button>
      </div>}
      <p className="flex justify-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" aria-hidden="true" />{checkout.secure}</p>
    </main>
    {finalOpen && canImprove && (preview
      ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><section role="dialog" aria-label="Final offer" className="classic-offer-dialog grid max-h-full w-full max-w-md gap-5 overflow-y-auto p-6" style={theme}>{finalCard}</section></div>
      : <Dialog open onOpenChange={next => { if (!next) leave(); }}>
          <DialogContent closeLabel={copy.close} className="classic-offer-dialog" style={theme}>{finalCard}</DialogContent>
        </Dialog>)}
  </div>;
}

// The celebration plays once per purchase: a reload of /gracias goes straight to the page.
const celebratedKey = sessionId => `purchase-celebrated:${sessionId}`;
function readCelebrated(sessionId) {
  try { return Boolean(sessionId) && window.sessionStorage.getItem(celebratedKey(sessionId)) === '1'; } catch { return false; }
}
export function ThankYou({ via, subdomain }) {
  useStorePresence(subdomain, 'thanks');
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  return <PurchaseThankYou key={sessionId} sessionId={sessionId} via={via} subdomain={subdomain} />;
}

function PurchaseThankYou({ sessionId, via, subdomain }) {
  const delivery = useQuery(api.storefront.getDelivery, sessionId ? { sessionId } : 'skip');
  // The store's look is only needed while the purchase loads or cannot be found.
  const context = useQuery(api.storefront.getCheckout, delivery?.presentation ? 'skip' : { subdomain });
  // celebrating → leaving (the book flies to its card, the page enters) → done (offer can open).
  const [phase, setPhase] = useState(() => (readCelebrated(sessionId) ? 'done' : 'celebrating'));
  // Once the book has flown to the page, the page keeps its hand-off classes.
  const [handoff, setHandoff] = useState(false);
  useEffect(() => {
    if (delivery?.status === 'paid') trackPixelOnce(`purchase-${sessionId}`, delivery.metaPixelIds, 'Purchase', { value: majorAmount(delivery.total, delivery.currency), currency: delivery.currency });
  }, [delivery, sessionId]);
  function finishCelebration() {
    try { window.sessionStorage.setItem(celebratedKey(sessionId), '1'); } catch { /* private mode: it may play again */ }
    setPhase('done');
  }
  const presentation = delivery?.presentation ?? { accentColor: context?.content?.style?.accentColor, ...context?.content?.footer, postLabels: context?.content?.postLabels };
  const paid = delivery?.status === 'paid';
  const deliveries = delivery?.deliveries ?? [];
  const product = delivery?.items?.find(item => item.role === 'main') ?? delivery?.items?.[0];
  const cover = deliveries.find(link => link.role === 'main' && link.coverUrl)?.coverUrl ?? deliveries.find(link => link.coverUrl)?.coverUrl ?? '';
  const celebrating = paid && phase === 'celebrating';
  const entrance = !paid || celebrating ? '' : `is-entering${handoff ? ' is-handoff' : ''}`;
  return <PurchaseResult status={sessionId && delivery === undefined ? 'loading' : delivery?.status ?? 'missing'} presentation={presentation} storeName={delivery?.storeName ?? context?.store?.name} emailed={delivery?.emailed} deliveries={deliveries} order={paid ? { items: delivery.items, total: delivery.total, currency: delivery.currency } : null} entrance={entrance}>
    {paid && phase !== 'done' && <PurchaseCelebration productName={product?.name ?? ''} coverUrl={cover} presentation={presentation} onExitStart={() => { setHandoff(true); setPhase('leaving'); }} onDone={finishCelebration} />}
    {paid && phase === 'done' && delivery.postPurchaseOffer && <PostPurchaseModal offer={delivery.postPurchaseOffer} currency={delivery.currency} sessionId={sessionId} via={via} accentColor={presentation.accentColor} />}
  </PurchaseResult>;
}

import { postLabels } from '../../shared/purchase-copy.js';
import { checkoutConfig } from '../../shared/checkout-copy.js';
import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/lib/api.js';
import { storefrontMoney as money } from '@/lib/storefront-money.js';
import { classicTheme } from '../../shared/classic-design.js';
import { postPurchaseStage } from '@/templates/PostPurchaseContent.jsx';
import PostPurchaseOfferCard from '@/templates/PostPurchaseOfferCard.jsx';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SessionPayment, stripeKey } from './CheckoutPayment.jsx';
import { claimExitIntent, leftDocument } from './exitIntent.js';
import { afterDecline, claimReopen, funnelStore, initialFunnel, nextStage } from './postPurchaseFunnel.js';

// The post-purchase offer of the thank-you page, in a modal that opens on load.
// Payment happens inside the same modal; the amounts are charged by the server.
export default function PostPurchaseModal({ offer, currency, sessionId, via, accentColor }) {
  const labels = postLabels(offer.content);
  const start = useAction(api.checkout.startPostPurchase);
  const [funnel, setFunnelState] = useState(() => funnelStore.read(sessionId) ?? initialFunnel());
  const [stage, setStage] = useState(() => nextStage(offer, funnel));
  const [open, setOpen] = useState(() => stage === 'offer');
  const [reopened, setReopened] = useState(false);
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const attempts = useRef(new Map());
  // Always the latest values, for the window listeners.
  const live = useRef({});
  live.current = { funnel, open, offer };

  function setFunnel(next) { setFunnelState(next); funnelStore.write(sessionId, next); }

  function decline() {
    const result = afterDecline(offer, funnel, stage, reopened);
    setFunnel(result.funnel);
    setPayment(null); setError('');
    if (result.stage) setStage(result.stage);
    else setOpen(false);
  }

  // Closing with the X or outside counts as declining this step, without moving on.
  function dismiss() {
    if (!funnel.declined.includes(stage)) setFunnel({ ...funnel, declined: [...funnel.declined, stage] });
    setPayment(null); setError(''); setOpen(false);
  }

  // Coming back to the tab (once) or the mouse leaving the page (twice) reopens the
  // modal on the next step not declined yet.
  useEffect(() => {
    let hidden = document.visibilityState === 'hidden';
    function reopen(trigger) {
      const { funnel: current, open: isOpen, offer: currentOffer } = live.current;
      if (isOpen) return;
      const claimed = claimReopen(currentOffer, current, trigger);
      if (!claimed) return;
      setFunnel(claimed);
      setStage(nextStage(currentOffer, claimed));
      setPayment(null); setError(''); setReopened(true); setOpen(true);
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hidden = true; return; }
      if (hidden) { hidden = false; reopen('visibility'); }
    };
    const onLeave = event => {
      if (leftDocument(event, window) && !live.current.open && claimExitIntent(`post-offer:${sessionId}`)) reopen('mouse');
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function accept() {
    if (busy || !stage) return;
    setBusy(true); setError('');
    // One attempt per step: retrying the same step reuses its order and Stripe session.
    let attempt = attempts.current.get(stage);
    if (!attempt) { attempt = { id: crypto.randomUUID(), failed: false }; attempts.current.set(stage, attempt); }
    try {
      const result = await start({
        parentSessionId: sessionId, attemptId: attempt.id, via, elements: true,
        ...(stage !== 'offer' ? { downsell: true } : {}), ...(stage === 'final' ? { finalDownsell: true } : {}),
        ...(attempt.failed ? { retry: true } : {}),
      });
      setPayment({ stage, clientSecret: result.clientSecret });
    } catch (failure) { attempt.failed = true; setError(labels.startError); }
    finally { setBusy(false); }
  }

  if (!stage) return null;
  const { price } = postPurchaseStage(offer, stage);
  // While Stripe confirms the payment the modal cannot be dismissed.
  const guard = event => { if (paying || busy) event.preventDefault(); };

  return <Dialog open={open} onOpenChange={next => { if (next) setOpen(true); else if (!paying && !busy) dismiss(); }}>
    <DialogContent closeLabel={labels.close} className="classic-offer-dialog post-offer-dialog max-w-lg" style={classicTheme(accentColor)} onInteractOutside={guard} onEscapeKeyDown={guard}>
      <PostPurchaseOfferCard offer={offer} currency={currency} stage={stage} busy={busy} error={error} canPurchase={Boolean(stripeKey)}
        onAccept={accept} onDecline={decline} Title={DialogTitle} Description={DialogDescription}
        payment={payment?.stage === stage ? <SessionPayment copy={checkoutConfig({ content: offer.content })} key={payment.clientSecret} clientSecret={payment.clientSecret} total={price} currency={currency} totalLabel={money(price, currency)} onPayingChange={setPaying} /> : null} />
    </DialogContent>
  </Dialog>;
}

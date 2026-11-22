import { landingExitConfig, backPopupConfig } from '../../shared/purchase-copy.js';
import { checkoutConfig } from '../../shared/checkout-copy.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { storefrontMoney as formatMoney } from '@/lib/storefront-money.js';
import { classicTheme } from '../../shared/classic-design.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import BackPopupContent from './DownsellModal.jsx';
import { watchBackIntent } from './downsell.js';
import { canShowExit, claimSessionExit, claimExitIntent, exitIntentCopy, leftDocument } from './exitIntent.js';

// Shown when the mouse leaves the public landing or checkout, at least 10s apart.
// `onCta` runs after the modal closes and decides where the visitor lands.
export default function ExitIntentModal({ view, step, onCta, onOffer, disabled = false }) {
  const [stage, setStage] = useState(null);
  const open = Boolean(stage);
  const afterClose = useRef(null);
  // There is no trigger button, so the element that had the focus is remembered here.
  const previousFocus = useRef(null);
  const scope = view.subdomain;

  useEffect(() => {
    if (open || disabled || !canShowExit(scope, step)) return;
    const root = document.documentElement;
    const show = () => {
      if (!claimSessionExit(scope, step)) return;
      afterClose.current = null;
      previousFocus.current = document.activeElement;
      setStage('exit');
    };
    // On touch screens, Back is the exit gesture after the first interaction.
    if (window.matchMedia('(pointer: coarse)').matches) return watchBackIntent(window, show);
    const onLeave = event => {
      if (leftDocument(event, window) && claimExitIntent(`mouse:${scope}:${step}`)) show();
    };
    root.addEventListener('pointerleave', onLeave);
    return () => root.removeEventListener('pointerleave', onLeave);
  }, [scope, step, open, disabled]);

  const copy = exitIntentCopy(view, step, amount => formatMoney(amount, view.store.currency));
  const accent = view.content.style?.accentColor;
  // Landing and checkout popups share the post-purchase modal's look: same palette and CTA.
  const theme = classicTheme(accent);
  const finish = action => { afterClose.current = action; setStage(null); };

  // The dialog stays mounted so it can hand the focus back when it closes.
  return <Dialog open={open} onOpenChange={next => { if (!next) setStage(null); }}>
    <DialogContent closeLabel={step === 'checkout' ? checkoutConfig(view).exitClose : landingExitConfig(view).exitClose} className="classic-offer-dialog" style={theme} onCloseAutoFocus={event => {
      event.preventDefault();
      const callback = afterClose.current;
      afterClose.current = null;
      if (callback) callback();
      else if (previousFocus.current?.isConnected) previousFocus.current.focus();
    }}>
      {stage === 'discount'
        ? <BackPopupContent copy={backPopupConfig(view)} Title={DialogTitle} Description={DialogDescription} onAccept={() => finish(onOffer)} onDecline={() => setStage(null)} />
        : <ExitContent copy={copy} useCta={() => finish(onCta)} onDiscount={onOffer && (() => setStage('discount'))} Title={DialogTitle} Description={DialogDescription} />}
    </DialogContent>
  </Dialog>;
}

function ExitContent({ copy, useCta, onDiscount, Title = "h2", Description = "p" }) {
  return <>
      <div className="space-y-3 pr-8">
        <p className="text-4xl leading-none" aria-hidden="true">{copy.emoji}</p>
        <Title className="text-2xl font-semibold tracking-tight">{copy.title}</Title>
        <Description className="leading-7 text-muted-foreground">{copy.intro}</Description>
      </div>
      <ul className="space-y-3">{copy.bullets.map(bullet => <li key={bullet} className="flex gap-3 text-sm leading-6"><Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>{bullet}</span></li>)}</ul>
      <Button type="button" size="lg" className="h-auto min-h-12 w-full py-3 text-base whitespace-normal" onClick={useCta}>{copy.button}<ArrowRight aria-hidden="true" /></Button>
      {onDiscount && <Button variant="ghost" type="button" onClick={onDiscount}>No, I want a discount</Button>}
      <p className="text-center text-xs leading-5 text-muted-foreground">{copy.closing}</p>
  </>;
}

export function ExitIntentPreview({ view, step = 'checkout', onDiscount }) {
  const [open, setOpen] = useState(true);
  if (!open) return <button type="button" className="m-5 rounded-lg border bg-card p-3" onClick={() => setOpen(true)}>Volver a abrir la vista previa</button>;
  const copy = exitIntentCopy(view, step, amount => formatMoney(amount, view.store.currency));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <section role="dialog" aria-modal="false" aria-label={copy.title} style={classicTheme(view.content.style?.accentColor)} className="classic-offer-dialog relative grid max-h-full w-full max-w-md gap-5 overflow-y-auto p-6 text-foreground">
      <button type="button" className="absolute right-3 top-3 size-11" aria-label={step === 'checkout' ? checkoutConfig(view).exitClose : landingExitConfig(view).exitClose} onClick={() => setOpen(false)}>×</button>
      <ExitContent copy={copy} useCta={() => setOpen(false)} onDiscount={onDiscount} />
    </section>
  </div>;
}

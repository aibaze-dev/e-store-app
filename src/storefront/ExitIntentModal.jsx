import { landingExitConfig } from '../../shared/purchase-copy.js';
import { checkoutConfig } from '../../shared/checkout-copy.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { storefrontMoney as formatMoney } from '@/lib/storefront-money.js';
import { classicTheme } from '../../shared/classic-design.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { claimExitIntent, exitIntentCopy, leftDocument } from './exitIntent.js';

// Shown when the mouse leaves the public landing or checkout, at least 10s apart.
// `onCta` runs after the modal closes and decides where the visitor lands.
export default function ExitIntentModal({ view, step, onCta }) {
  const [open, setOpen] = useState(false);
  const viaCta = useRef(false);
  // There is no trigger button, so the element that had the focus is remembered here.
  const previousFocus = useRef(null);
  const scope = view.subdomain;

  useEffect(() => {
    if (open) return;
    const root = document.documentElement;
    const onLeave = event => {
      if (!leftDocument(event, window)) return;
      if (!claimExitIntent(scope)) return;
      viaCta.current = false;
      previousFocus.current = document.activeElement;
      setOpen(true);
    };
    root.addEventListener('pointerleave', onLeave);
    return () => root.removeEventListener('pointerleave', onLeave);
  }, [scope, open]);

  const copy = exitIntentCopy(view, step, amount => formatMoney(amount, view.store.currency));
  const accent = view.content.style?.accentColor;
  // The landing paints its buttons with the store's accent; the checkout uses the app theme.
  const theme = step === 'landing' ? classicTheme(accent) : undefined;
  const useCta = () => { viaCta.current = true; setOpen(false); };

  // The dialog stays mounted so it can hand the focus back when it closes.
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent closeLabel={step === 'checkout' ? checkoutConfig(view).exitClose : landingExitConfig(view).exitClose} className={step === 'landing' ? 'classic-offer-dialog' : undefined} style={theme} onCloseAutoFocus={event => {
      event.preventDefault();
      const usedCta = viaCta.current;
      viaCta.current = false;
      if (usedCta) onCta();
      else if (previousFocus.current?.isConnected) previousFocus.current.focus();
    }}>
      <ExitContent copy={copy} useCta={useCta} Title={DialogTitle} Description={DialogDescription} />
    </DialogContent>
  </Dialog>;
}

function ExitContent({ copy, useCta, Title = "h2", Description = "p" }) {
  return <>
      <div className="space-y-3 pr-8">
        <p className="text-4xl leading-none" aria-hidden="true">{copy.emoji}</p>
        <Title className="text-2xl font-semibold tracking-tight">{copy.title}</Title>
        <Description className="leading-7 text-muted-foreground">{copy.intro}</Description>
      </div>
      <ul className="space-y-3">{copy.bullets.map(bullet => <li key={bullet} className="flex gap-3 text-sm leading-6"><Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>{bullet}</span></li>)}</ul>
      <Button type="button" size="lg" className="h-auto min-h-12 w-full py-3 text-base whitespace-normal" onClick={useCta}>{copy.button}<ArrowRight aria-hidden="true" /></Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">{copy.closing}</p>
  </>;
}

export function ExitIntentPreview({ view, step = 'checkout' }) {
  const [open, setOpen] = useState(true);
  if (!open) return <button type="button" className="m-5 rounded-lg border bg-card p-3" onClick={() => setOpen(true)}>Volver a abrir la vista previa</button>;
  const copy = exitIntentCopy(view, step, amount => formatMoney(amount, view.store.currency));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <section role="dialog" aria-modal="false" aria-label={copy.title} style={step === 'landing' ? classicTheme(view.content.style?.accentColor) : undefined} className={`relative grid max-h-full w-full max-w-md gap-5 overflow-y-auto rounded-xl border bg-background p-6 text-foreground shadow-lg ${step === 'landing' ? 'classic-offer-dialog' : ''}`}>
      <button type="button" className="absolute right-3 top-3 size-11" aria-label={step === 'checkout' ? checkoutConfig(view).exitClose : landingExitConfig(view).exitClose} onClick={() => setOpen(false)}>×</button>
      <ExitContent copy={copy} useCta={() => setOpen(false)} />
    </section>
  </div>;
}

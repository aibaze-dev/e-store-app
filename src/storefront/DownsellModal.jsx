import { backPopupConfig } from '../../shared/purchase-copy.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { classicTheme } from '../../shared/classic-design.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { exitIntentSession } from './exitIntent.js';
import { watchBackIntent } from './downsell.js';

// Shown once per tab when the visitor goes back on the landing or its checkout, for stores
// with the downsell on. `onAccept` runs after the modal closes and opens the offer page.
export default function DownsellModal({ view, step, onAccept, preview = false }) {
  const [open, setOpen] = useState(preview);
  const accepted = useRef(false);
  const scope = `downsell:${view.subdomain}`;

  useEffect(() => {
    if (preview) return;
    if (exitIntentSession.seen(scope)) return undefined;
    return watchBackIntent(window, () => { exitIntentSession.mark(scope); setOpen(true); });
  }, [scope, preview]);

  const copy = backPopupConfig(view);
  const accent = view.content.style?.accentColor;
  // The landing paints its buttons with the store's accent; the checkout uses the app theme.
  const theme = step === 'landing' ? classicTheme(accent) : undefined;

  if (preview) return open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <section role="dialog" aria-modal="false" aria-label={copy.modalTitle} style={theme} className={`relative grid max-h-full w-full max-w-md gap-5 overflow-y-auto rounded-xl border bg-background p-6 text-foreground shadow-lg ${step === 'landing' ? 'classic-offer-dialog' : ''}`}>
      <button type="button" className="absolute right-3 top-3 size-11" aria-label={copy.close} onClick={() => setOpen(false)}>×</button>
      <BackPopupContent copy={copy} onAccept={onAccept} onDecline={() => setOpen(false)} />
    </section>
  </div> : <button type="button" className="m-5 rounded-lg border bg-card p-3" onClick={() => setOpen(true)}>Volver a abrir la vista previa</button>;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent closeLabel={copy.close} className={step === 'landing' ? 'classic-offer-dialog' : undefined} style={theme} onCloseAutoFocus={event => { if (accepted.current) { event.preventDefault(); onAccept(); } }}>
      <BackPopupContent copy={copy} Title={DialogTitle} Description={DialogDescription} onAccept={() => { accepted.current = true; setOpen(false); }} onDecline={() => setOpen(false)} />
    </DialogContent>
  </Dialog>;
}

function BackPopupContent({ copy, onAccept, onDecline, Title = "h2", Description = "p" }) {
 return <>
      <div className="space-y-3 pr-8">
        <Title className="text-2xl font-semibold tracking-tight">{copy.modalTitle}</Title>
        <Description className="leading-7 text-muted-foreground">{copy.modalSubtitle}</Description>
      </div>
      <div className="grid gap-2">
        <Button type="button" size="lg" className="h-auto min-h-12 w-full py-3 text-base whitespace-normal" onClick={onAccept}>{copy.acceptText}<ArrowRight aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" className="h-auto min-h-11 w-full whitespace-normal" onClick={onDecline}>{copy.declineText}</Button>
      </div>
 </>;
}

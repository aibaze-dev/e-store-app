import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { readableOn } from '@/templates/ClassicLanding.jsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { exitIntentSession } from './exitIntent.js';
import { downsellCopy, watchBackIntent } from './downsell.js';

// Shown once per tab when the visitor goes back on the landing or its checkout, for stores
// with the downsell on. `onAccept` runs after the modal closes and opens the offer page.
export default function DownsellModal({ view, step, onAccept }) {
  const [open, setOpen] = useState(false);
  const accepted = useRef(false);
  const scope = `downsell:${view.subdomain}`;

  useEffect(() => {
    if (exitIntentSession.seen(scope)) return undefined;
    return watchBackIntent(window, () => { exitIntentSession.mark(scope); setOpen(true); });
  }, [scope]);

  const copy = downsellCopy(view.downsell);
  const accent = view.content.style?.accentColor;
  // The landing paints its buttons with the store's accent; the checkout uses the app theme.
  const theme = step === 'landing' && /^#[0-9a-fA-F]{6}$/.test(accent || '') ? { '--primary': accent, '--primary-foreground': readableOn(accent) } : undefined;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent style={theme} onCloseAutoFocus={event => { if (accepted.current) { event.preventDefault(); onAccept(); } }}>
      <div className="space-y-3 pr-8">
        <DialogTitle>{copy.modalTitle}</DialogTitle>
        <DialogDescription>{copy.modalSubtitle}</DialogDescription>
      </div>
      <div className="grid gap-2">
        <Button type="button" size="lg" className="h-auto min-h-12 w-full py-3 text-base whitespace-normal" onClick={() => { accepted.current = true; setOpen(false); }}>{copy.acceptText}<ArrowRight aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" className="h-auto min-h-11 w-full whitespace-normal" onClick={() => setOpen(false)}>{copy.declineText}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

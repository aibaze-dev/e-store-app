import { useState } from 'react';
import { ExitIntentPreview } from '@/storefront/ExitIntentModal.jsx';
import BackPopupContent from '@/storefront/DownsellModal.jsx';
import { backPopupConfig } from '../../shared/purchase-copy.js';
import { DownsellOfferView } from '@/storefront/CheckoutPages.jsx';

export default function PopupPreview({ view, target }) {
  const [current, setCurrent] = useState(target);
  if (current === 'popup-back-page' || current === 'popup-offer-final') {
    return <DownsellOfferView view={view} preview previewFinal={current === 'popup-offer-final'} />;
  }
  if (current.startsWith('popup-exit')) {
    const step = current.endsWith('checkout') ? 'checkout' : 'landing';
    return <ExitIntentPreview view={view} step={step} onDiscount={step === 'checkout' && view.downsell ? () => setCurrent('popup-back-checkout') : undefined} />;
  }
  if (!view.downsell) return <p className="p-6">Activá el descuento del producto principal para ver esta oferta.</p>;
  return <div className="fixed inset-0 grid place-items-center bg-black/60 p-4">
    <section role="dialog" aria-label={backPopupConfig(view).modalTitle} className="grid w-full max-w-md gap-5 rounded-xl bg-card p-6">
      <BackPopupContent copy={backPopupConfig(view)} onAccept={() => setCurrent('popup-back-page')} onDecline={() => setCurrent('popup-exit-checkout')} />
    </section>
  </div>;
}

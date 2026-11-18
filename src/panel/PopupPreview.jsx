import { useState } from 'react';
import { ExitIntentPreview } from '@/storefront/ExitIntentModal.jsx';
import DownsellModal from '@/storefront/DownsellModal.jsx';
import { DownsellOfferView } from '@/storefront/Storefront.jsx';

export default function PopupPreview({ view, target }) {
  const [page, setPage] = useState(false);
  if (target === 'popup-back-page' || page) return <><button type="button" className="m-3 rounded-lg border p-3 text-sm" onClick={() => setPage(false)} disabled={target === 'popup-back-page'}>Volver al popup de prueba</button><DownsellOfferView view={view} preview /></>;
  const step = target.endsWith('checkout') ? 'checkout' : 'landing';
  return <div className="min-h-screen bg-muted/40">
    {target.startsWith('popup-exit') ? <ExitIntentPreview view={view} step={step} /> : view.downsell ? <DownsellModal view={view} step={step} preview onAccept={() => setPage(true)} /> : <p className="p-6 text-sm leading-6">Esta tienda no tiene un descuento del producto principal activo. Configuralo en Downsell para ver el popup con su oferta real.</p>}
  </div>;
}

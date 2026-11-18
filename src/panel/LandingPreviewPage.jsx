import PopupJourney from './PopupJourney.jsx';
import PopupPreview from './PopupPreview.jsx';
import { POPUP_PREVIEW_TARGETS, PURCHASE_PREVIEW_STATES } from '../../shared/purchase-copy.js';
import { CheckoutView } from '@/storefront/Storefront.jsx';
import { useState } from 'react';
import { PostPurchasePreview } from '@/templates/PostPurchaseContent.jsx';
import { POST_PURCHASE_PREVIEW_STAGES } from '../../shared/post-purchase.js';
import { NativeSelect } from '@/components/ui/native-select';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@/lib/api.js';
import { templateFor } from '@/templates/index.js';
import { Button } from '@/components/ui/button';
import { EmptyState, PageSkeleton } from '@/components/Field.jsx';
import { InternalTheme, ThemeToggle } from '@/components/InternalTheme.jsx';

export default function LandingPreviewPage() {
  const { storeId } = useParams();
  const [revision, setRevision] = useState(0);
  const [postState, setPostState] = useState('offer');
  const [target, setTarget] = useState('landing');
  const [postAsModal, setPostAsModal] = useState(true);
  const view = useQuery(api.landings.preview, { storeId });
  if (view === undefined) return <InternalTheme><main className="mx-auto max-w-[1120px] px-5 py-8"><PageSkeleton label="Cargando vista previa" /></main></InternalTheme>;
  if (view === null) return <InternalTheme><main className="mx-auto max-w-[1120px] px-5 py-8"><EmptyState title="Todavía no hay un borrador para mostrar">
    <Button asChild variant="outline"><Link to={`/panel/tiendas/${storeId}/landing`}>Ir a la landing</Link></Button>
  </EmptyState></main></InternalTheme>;
  const Template = templateFor(view.template);
  return <>
    <InternalTheme fullHeight={false} className="sticky top-0 z-10">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3 text-sm">
      <p><strong className="font-semibold">Vista previa del borrador.</strong> <span className="text-muted-foreground">La compra está deshabilitada acá.</span></p>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Página de la vista previa" value={target} onChange={event => { setTarget(event.target.value); setRevision(current => current + 1); }}><option value="landing">Landing principal</option><option value="checkout">Checkout</option><option value="post">Post-compra</option>{Object.entries(POPUP_PREVIEW_TARGETS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="post-downsell">Post-compra · una oportunidad más</option><option value="post-final">Post-compra · última oportunidad</option></NativeSelect>
        {target.startsWith('post') && <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={postAsModal} onChange={event => setPostAsModal(event.target.checked)} />Ver como modal</label>}
        <Button variant="outline" onClick={() => setRevision(current => current + 1)}>Reiniciar recorrido de prueba</Button><ThemeToggle />
        <Button asChild variant="outline"><Link to={`/panel/tiendas/${storeId}/landing`}>Volver a editar</Link></Button>
      </div>
    </div>
    </InternalTheme>
    <div className="mx-auto max-w-6xl p-5"><PopupJourney view={view} target={target} onChoose={value => { setRevision(current => current + 1); setTarget(value); setPostState('offer'); }} /></div>
    {target.startsWith('post') && <div className="mx-auto max-w-6xl p-5"><NativeSelect aria-label="Estado de post-compra" value={postState} onChange={event => setPostState(event.target.value)}>{Object.entries(PURCHASE_PREVIEW_STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></div>}
    {target.startsWith('popup') ? <div className="relative mx-auto h-[700px] max-w-6xl overflow-auto" style={{ transform: 'translateZ(0)' }}><PopupPreview key={`${target}:${revision}`} view={view} target={target} /></div> : target === 'checkout' ? <CheckoutView view={view} preview /> : target === 'landing' ? <Template view={view} /> : <PostPurchasePreview key={revision} view={view} stage={POST_PURCHASE_PREVIEW_STAGES[target]} modal={postAsModal} state={postState} onStageChange={stage => setTarget({ offer: 'post', downsell: 'post-downsell', final: 'post-final' }[stage])} />}
  </>;
}

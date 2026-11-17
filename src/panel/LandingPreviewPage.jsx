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
  const [target, setTarget] = useState('landing');
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
      <div className="flex items-center gap-2">
        <NativeSelect aria-label="Página de la vista previa" value={target} onChange={event => setTarget(event.target.value)}><option value="landing">Landing principal</option><option value="post">Post-compra</option>{view.postPurchaseOffer?.downsellPrice > 0 && <option value="post-downsell">Post-compra con descuento</option>}{view.postPurchaseOffer && <option value="post-final">Post-compra con último descuento</option>}</NativeSelect>
        <ThemeToggle />
        <Button asChild variant="outline"><Link to={`/panel/tiendas/${storeId}/landing`}>Volver a editar</Link></Button>
      </div>
    </div>
    </InternalTheme>
    {target === 'landing' ? <Template view={view} /> : <PostPurchasePreview view={view} stage={POST_PURCHASE_PREVIEW_STAGES[target]} />}
  </>;
}

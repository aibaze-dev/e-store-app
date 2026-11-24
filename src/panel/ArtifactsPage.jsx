import { useQuery } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useState } from 'react';
import { ArrowUpRight, Check, Copy, Pencil, Settings2, ShoppingBag, Sparkles } from 'lucide-react';
import { artifacts } from '@/artifacts/registry.js';
import { artifactUrl } from '@/lib/site.js';
import { Button } from '@/components/ui/button';
import { EmptyState, Field, PageSkeleton } from '@/components/Field.jsx';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { useStoreWorkspace } from './StoreWorkspace.jsx';

const SCOPES = [{ id: 'all', label: 'Todos' }, { id: 'store', label: 'Por tienda' }, { id: 'none', label: 'Sin tienda' }];
import { CatalogHeader, CoverArt, StatusPill } from './CatalogParts.jsx';

function ArtifactCard({ artifact, product, stores = [] }) {
  const [copyState, setCopyState] = useState('idle');
  const url = artifactUrl(artifact.slug);
  const editPath = `/panel/artefactos/${artifact.slug}`;

  async function copyLink() {
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return <article className="catalog-card">
    <CoverArt src={artifact.coverUrl} title={artifact.name} variant="tool" />
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
      <StatusPill status={product?.status} configured={Boolean(product)} />
      <h2 className="text-base leading-snug font-semibold break-words"><Link to={editPath} className="hover:underline hover:underline-offset-4">{artifact.name}</Link></h2>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ShoppingBag className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{stores.length ? stores.map(store => store.name).join(', ') : 'Sin tienda'}</span></p>
      <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{artifact.description}</p>
      <p className="catalog-url" title={url}>{url.replace(/^https?:\/\//, '')}</p>
      <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
        <Button asChild variant={product ? 'outline' : 'default'} className="flex-1"><Link to={editPath}>{product ? <Pencil aria-hidden="true" /> : <Settings2 aria-hidden="true" />}{product ? 'Editar ficha' : 'Configurar ficha'}<span className="sr-only"> de {artifact.name}</span></Link></Button>
        <Button variant="ghost" size="icon" className="size-11" onClick={copyLink} disabled={copyState === 'copying'} aria-label={copyState === 'copied' ? `Enlace de ${artifact.name} copiado` : `Copiar enlace de ${artifact.name}`}>
          {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
        <Button asChild variant="ghost" size="icon" className="size-11"><a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${artifact.name} en otra pestaña`}><ArrowUpRight aria-hidden="true" /></a></Button>
      </div>
      <p role="status" className="sr-only">{copyState === 'copied' ? `Enlace de ${artifact.name} copiado.` : ''}</p>
      {copyState === 'failed' && <div className="space-y-2">
        <p role="alert" className="text-sm text-muted-foreground">No pudimos copiar el enlace. Seleccionalo y copialo manualmente.</p>
        <Field label={`Enlace de ${artifact.name}`}>{props => <Input {...props} type="url" value={url} readOnly onFocus={event => event.target.select()} />}</Field>
      </div>}
    </div>
  </article>;
}

export default function ArtifactsPage() {
  const { store: currentStore } = useStoreWorkspace();
  const products = useQuery(api.products.list, {});
  const usage = useQuery(api.products.storeUsage, {});
  const stores = useQuery(api.stores.list, {});
  const [scope, setScope] = useState('all');
  const [storeId, setStoreId] = useState(currentStore?._id ?? '');
  const scopeStoreId = storeId || stores?.[0]?._id || '';
  const productFor = artifact => products?.find(item => item.type === 'artifact' && item.artifactSlug === artifact.slug);
  // An artifact without a product sheet cannot be offered, so it belongs to no store.
  const usedIn = product => (product && usage?.[product._id]) || [];
  const visible = artifacts.filter(artifact => {
    const used = usedIn(productFor(artifact));
    return scope === 'all' || (scope === 'none' ? used.length === 0 : used.some(store => store._id === scopeStoreId));
  });
  const configured = products?.filter(item => item.type === 'artifact' && artifacts.some(artifact => artifact.slug === item.artifactSlug)) ?? [];
  return <div className="space-y-6">
    <CatalogHeader
      eyebrow="Herramientas interactivas"
      icon={Sparkles}
      title="Artefactos"
      description="Configurá la ficha comercial de cada herramienta para ofrecerla como producto, bono gratis o upsell en cualquiera de tus tiendas."
      stats={products && artifacts.length ? [
        { label: 'Herramientas', value: artifacts.length },
        { label: 'Con ficha', value: configured.length },
        { label: 'Activas', value: configured.filter(item => item.status === 'active').length },
      ] : []}
    />
    {products === undefined ? <PageSkeleton label="Cargando artefactos" /> : artifacts.length === 0
      ? <EmptyState title="Todavía no hay artefactos"><p>Las herramientas aparecerán acá cuando estén disponibles. Podrás abrirlas y copiar su enlace público.</p></EmptyState>
      : <>
        <div className="flex flex-wrap items-center gap-3">
          <div className="catalog-segmented" role="group" aria-label="Filtrar por tienda">
            {SCOPES.map(item => <button key={item.id} type="button" aria-pressed={scope === item.id} disabled={item.id !== 'all' && usage === undefined} className={cn(scope === item.id && 'is-active')} onClick={() => setScope(item.id)}>{item.label}</button>)}
          </div>
          {scope === 'store' && (stores?.length
            ? <div className="w-full sm:w-56"><NativeSelect aria-label="Tienda" value={scopeStoreId} onChange={event => setStoreId(event.target.value)}>{stores.map(store => <option key={store._id} value={store._id}>{store.name}</option>)}</NativeSelect></div>
            : stores && <p className="text-sm text-muted-foreground">Todavía no hay tiendas.</p>)}
        </div>
        {visible.length === 0
          ? <EmptyState title="No hay artefactos con ese filtro"><p>Probá con otra tienda o mirá todos.</p><Button variant="outline" onClick={() => setScope('all')}>Ver todos</Button></EmptyState>
          : <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visible.map(artifact => {
            const product = productFor(artifact);
            return <li key={artifact.slug} className="flex"><ArtifactCard artifact={{ ...artifact, ...(product ? { name: product.name, description: product.shortDescription || product.description, coverUrl: product.coverUrl } : {}) }} product={product} stores={usedIn(product)} /></li>;
          })}</ul>}
      </>}
  </div>;
}

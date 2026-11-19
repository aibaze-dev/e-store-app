import { useStoreWorkspace } from './StoreWorkspace.jsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { ArrowRight, FileText, Library, Link2, Plus, Search, Star } from 'lucide-react';
import { api } from '@/lib/api.js';
import { formatMoney } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageSkeleton } from '@/components/Field.jsx';
import { CatalogHeader, CoverArt, StatusPill, deliverableCounts, deliverableSummary } from './CatalogParts.jsx';

const FILTERS = [{ id: 'all', label: 'Todos' }, { id: 'active', label: 'Activos' }, { id: 'archived', label: 'Archivados' }];

function EbookCard({ product, to }) {
  const { files, links, total } = deliverableCounts(product.deliverables);
  return <article className="catalog-card group">
    <CoverArt src={product.coverUrl} title={product.name} variant="book" />
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={product.status} />
        {product.featured && <span className="catalog-chip"><Star className="size-3.5" aria-hidden="true" />Destacado</span>}
      </div>
      <h2 className="text-base leading-snug font-semibold break-words">
        <Link to={to} className="catalog-card-link">{product.name}</Link>
      </h2>
      {(product.shortDescription || product.description) && <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{product.shortDescription || product.description}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label={deliverableSummary(product.deliverables)}>
          {total === 0 && <span>Sin entregables</span>}
          {files > 0 && <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" aria-hidden="true" />{files === 1 ? '1 documento' : `${files} documentos`}</span>}
          {links > 0 && <span className="inline-flex items-center gap-1.5"><Link2 className="size-3.5" aria-hidden="true" />{links === 1 ? '1 enlace' : `${links} enlaces`}</span>}
        </p>
        {product.referencePrice?.value > 0 && <p className="text-xs text-muted-foreground">Precio normal <span className="font-semibold text-foreground">{formatMoney(product.referencePrice.value, product.referencePrice.currency)}</span></p>}
      </div>
    </div>
    <ArrowRight className="catalog-card-arrow" aria-hidden="true" />
  </article>;
}

export default function ProductsPage() {
  const { productsPath } = useStoreWorkspace();
  const resources = useQuery(api.products.list, {});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const products = resources?.filter(product => product.type !== 'artifact');
  const active = products?.filter(product => product.status === 'active').length ?? 0;
  const documents = products?.reduce((sum, product) => sum + deliverableCounts(product.deliverables).total, 0) ?? 0;
  const term = query.trim().toLowerCase();
  const visible = products?.filter(product => (filter === 'all' || product.status === filter) && (!term || product.name.toLowerCase().includes(term)));
  const newButton = <Button asChild size="lg"><Link to={`${productsPath}/nuevo`}><Plus aria-hidden="true" />Nuevo ebook</Link></Button>;

  return <div className="space-y-6">
    <CatalogHeader
      eyebrow="Recursos compartidos"
      icon={Library}
      title="Catálogo de ebooks"
      description="Cada ebook se carga una sola vez con sus documentos y puede usarse como principal, bono o extra en cualquiera de tus tiendas."
      stats={products?.length ? [
        { label: 'Ebooks', value: products.length },
        { label: 'Activos', value: active },
        { label: 'Entregables', value: documents },
      ] : []}
      action={products?.length > 0 && newButton}
    />

    {products === undefined && <PageSkeleton label="Cargando ebooks" />}
    {products?.length === 0 && <EmptyState title="Todavía no hay ebooks">
      <p>Cargá tu primer ebook con los documentos que va a recibir quien lo compre.</p>
      {newButton}
    </EmptyState>}
    {products?.length > 0 && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="catalog-segmented" role="group" aria-label="Filtrar por estado">
          {FILTERS.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} className={cn(filter === item.id && 'is-active')} onClick={() => setFilter(item.id)}>{item.label}</button>)}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre" aria-label="Buscar ebooks por nombre" className="pl-9" />
        </div>
      </div>
      {visible.length === 0
        ? <EmptyState title="No hay ebooks con ese filtro"><p>Probá con otro nombre o cambiá el estado.</p><Button variant="outline" onClick={() => { setQuery(''); setFilter('all'); }}>Ver todos</Button></EmptyState>
        : <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map(product => <li key={product._id} className="flex"><EbookCard product={product} to={`${productsPath}/${product._id}`} /></li>)}</ul>}
    </>}
  </div>;
}

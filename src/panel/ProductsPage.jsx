import { useStoreWorkspace } from './StoreWorkspace.jsx';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { AppWindow, ArrowRight, ArrowUpRight, FileText, Library, Link2, Plus, Search, ShoppingBag, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText, formatMoney } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { EmptyState, ErrorAlert, PageSkeleton } from '@/components/Field.jsx';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useInternalThemeClass } from '@/components/InternalTheme.jsx';
import { CatalogHeader, CoverArt, StatusPill, deliverableCounts, deliverableSummary } from './CatalogParts.jsx';
import { ViewContentButton } from './DeliverableViewer.jsx';
import { findLanguage } from '../../shared/languages.js';

const FILTERS = [{ id: 'all', label: 'Todos' }, { id: 'active', label: 'Activos' }, { id: 'archived', label: 'Archivados' }];
const SCOPES = [{ id: 'all', label: 'Todos' }, { id: 'store', label: 'Por tienda' }, { id: 'none', label: 'Sin tienda' }];

function EbookCard({ product, to, stores = [], onDelete }) {
  const { files, links, total } = deliverableCounts(product.deliverables);
  const app = product.type === 'app';
  const appUrl = app ? product.deliverables[0]?.url : '';
  const language = findLanguage(product.language);
  return <article className="catalog-card group">
    <CoverArt src={product.coverUrl} title={product.name} variant={app ? 'tool' : 'book'} />
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={product.status} />
        {language && <span className="catalog-chip" title={language.name}><span aria-hidden="true">{language.flag}</span>{language.code.toUpperCase()}<span className="sr-only"> · Idioma: {language.name}</span></span>}
        {app && <span className="catalog-chip"><AppWindow className="size-3.5" aria-hidden="true" />App</span>}
        {product.featured && <span className="catalog-chip"><Star className="size-3.5" aria-hidden="true" />Destacado</span>}
        {!app && <Button type="button" variant="ghost" size="icon" className="relative z-10 ml-auto text-destructive" aria-label={`Eliminar ebook «${product.name}»`} title="Eliminar ebook" onClick={event => onDelete(product, event.currentTarget)}>
          <Trash2 aria-hidden="true" />
        </Button>}
      </div>
      <h2 className="text-base leading-snug font-semibold break-words">
        <Link to={to} className="catalog-card-link">{product.name}</Link>
      </h2>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ShoppingBag className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{stores.length ? stores.map(store => store.name).join(', ') : 'Sin tienda'}</span></p>
      {(product.shortDescription || product.description) && <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{product.shortDescription || product.description}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label={deliverableSummary(product.deliverables)}>
          {app && <span className="inline-flex items-center gap-1.5"><Link2 className="size-3.5" aria-hidden="true" />Link a la app</span>}
          {!app && total === 0 && <span>Sin entregables</span>}
          {!app && files > 0 && <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" aria-hidden="true" />{files === 1 ? '1 documento' : `${files} documentos`}</span>}
          {!app && links > 0 && <span className="inline-flex items-center gap-1.5"><Link2 className="size-3.5" aria-hidden="true" />{links === 1 ? '1 enlace' : `${links} enlaces`}</span>}
        </p>
        {product.referencePrice?.value > 0 && <p className="text-xs text-muted-foreground">Precio normal <span className="font-semibold text-foreground">{formatMoney(product.referencePrice.value, product.referencePrice.currency)}</span></p>}
      </div>
      {app
        ? appUrl && <Button asChild variant="outline" className="relative z-10 w-full"><a href={appUrl} target="_blank" rel="noopener noreferrer">Abrir app<ArrowUpRight aria-hidden="true" /><span className="sr-only"> {product.name} en otra pestaña</span></a></Button>
        : total > 0 && <ViewContentButton product={product} className="relative z-10 w-full" />}
    </div>
    <ArrowRight className="catalog-card-arrow" aria-hidden="true" />
  </article>;
}

export default function ProductsPage() {
  const { productsPath, store: currentStore } = useStoreWorkspace();
  const resources = useQuery(api.products.list, {});
  const usage = useQuery(api.products.storeUsage, {});
  const stores = useQuery(api.stores.list, {});
  const [scope, setScope] = useState('all');
  const [storeId, setStoreId] = useState(currentStore?._id ?? '');
  const scopeStoreId = storeId || stores?.[0]?._id || '';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const opener = useRef(null);
  const catalog = useRef(null);
  const removeEbook = useMutation(api.products.removeEbook);
  const themeClass = useInternalThemeClass();
  const linkedStores = usage?.[deleteTarget?._id] ?? [];

  function openDelete(product, button) {
    opener.current = button;
    setDeleteError('');
    setDeleteTarget(product);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting || linkedStores.length || !usage) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await removeEbook({ id: deleteTarget._id });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(errorText(error, 'No se pudo eliminar el ebook. Volvé a intentar.'));
    } finally {
      setDeleting(false);
    }
  }
  const products = resources?.filter(product => product.type !== 'artifact');
  const active = products?.filter(product => product.status === 'active').length ?? 0;
  const documents = products?.reduce((sum, product) => sum + deliverableCounts(product.deliverables).total, 0) ?? 0;
  const term = query.trim().toLowerCase();
  const usedIn = product => usage?.[product._id] ?? [];
  const inScope = product => scope === 'all' || (scope === 'none' ? usedIn(product).length === 0 : usedIn(product).some(store => store._id === scopeStoreId));
  const visible = products?.filter(product => (filter === 'all' || product.status === filter) && inScope(product) && (!term || product.name.toLowerCase().includes(term)));
  const newButton = <Button asChild size="lg"><Link to={`${productsPath}/nuevo`}><Plus aria-hidden="true" />Nuevo producto</Link></Button>;

  return <div className="space-y-6" ref={catalog} tabIndex={-1}>
    <CatalogHeader
      eyebrow="Recursos compartidos"
      icon={Library}
      title="Catálogo de ebooks"
      description="Cada ebook o app se carga una sola vez y puede usarse como principal, bono o extra en cualquiera de tus tiendas."
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="catalog-segmented" role="group" aria-label="Filtrar por tienda">
            {SCOPES.map(item => <button key={item.id} type="button" aria-pressed={scope === item.id} disabled={item.id !== 'all' && usage === undefined} className={cn(scope === item.id && 'is-active')} onClick={() => setScope(item.id)}>{item.label}</button>)}
          </div>
          {scope === 'store' && (stores?.length
            ? <div className="w-full sm:w-56"><NativeSelect aria-label="Tienda" value={scopeStoreId} onChange={event => setStoreId(event.target.value)}>{stores.map(store => <option key={store._id} value={store._id}>{store.name}</option>)}</NativeSelect></div>
            : stores && <p className="text-sm text-muted-foreground">Todavía no hay tiendas.</p>)}
          <div className="catalog-segmented" role="group" aria-label="Filtrar por estado">
            {FILTERS.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} className={cn(filter === item.id && 'is-active')} onClick={() => setFilter(item.id)}>{item.label}</button>)}
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre" aria-label="Buscar ebooks por nombre" className="pl-9" />
        </div>
      </div>
      {visible.length === 0
        ? <EmptyState title="No hay ebooks con ese filtro"><p>Probá con otro nombre, otra tienda o cambiá el estado.</p><Button variant="outline" onClick={() => { setQuery(''); setFilter('all'); setScope('all'); }}>Ver todos</Button></EmptyState>
        : <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map(product => <li key={product._id} className="flex"><EbookCard product={product} stores={usedIn(product)} to={`${productsPath}/${product._id}`} onDelete={openDelete} /></li>)}</ul>}
    </>}
    <Dialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !deleting) setDeleteTarget(null); }}>
      <DialogContent role="alertdialog" className={themeClass} onCloseAutoFocus={event => {
        event.preventDefault();
        (opener.current?.isConnected ? opener.current : catalog.current)?.focus();
      }}>
        <DialogTitle className="pr-8">{linkedStores.length ? 'Ebook asociado a una tienda' : 'Eliminar ebook'}</DialogTitle>
        <DialogDescription className="break-words">
          {linkedStores.length
            ? `Para eliminar «${deleteTarget?.name}», primero quitalo de la oferta de estas tiendas: ${linkedStores.map(store => store.name).join(', ')}.`
            : `¿Querés eliminar «${deleteTarget?.name ?? ''}» del catálogo? La eliminación es permanente.`}
        </DialogDescription>
        <ErrorAlert>{deleteError}</ErrorAlert>
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild><Button variant="outline" disabled={deleting}>{linkedStores.length ? 'Cerrar' : 'Cancelar'}</Button></DialogClose>
          {!linkedStores.length && <Button variant="destructive" disabled={deleting || !usage} onClick={confirmDelete}>{deleting ? 'Eliminando…' : 'Eliminar ebook'}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

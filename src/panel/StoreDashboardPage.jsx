import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { ArrowRight, BookOpen, Check, CircleCheck, CircleDashed, Copy, ExternalLink, Gift, Globe, Link2, ShoppingCart, Sparkles, Tag } from 'lucide-react';
import { api } from '@/lib/api.js';
import { landingUrls } from '@/lib/site.js';
import { storePath } from '@/lib/panel-routes.js';
import { formatDate, formatMoney, STATUS_LABELS, statusVariant } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageSkeleton } from '@/components/Field.jsx';
import StoreOfferSummary, { LandingContentSummary } from './StoreOfferSummary.jsx';
import { useStoreWorkspace } from './StoreWorkspace.jsx';

export function ShareLink({ label, url, icon: Icon, enabled }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true); setError('');
    } catch {
      setError('No se pudo copiar. Seleccioná y copiá el link de arriba.');
    }
  }
  return <div className="dashboard-share-row">
    <span className="dashboard-icon"><Icon aria-hidden="true" /></span>
    <div className="min-w-0 flex-1 space-y-1">
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="select-all text-sm leading-6 font-medium break-all sm:text-base">{url || 'Guardá la dirección de tu landing para generar este link.'}</p>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
    <div className="flex shrink-0 gap-2">
      <Button variant="outline" onClick={copy} disabled={!enabled} aria-label={`Copiar link de ${label.toLowerCase()}`}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span aria-live="polite">{copied ? 'Copiado' : 'Copiar'}</span>
      </Button>
      {enabled
        ? <Button asChild><a href={url} target="_blank" rel="noreferrer" aria-label={`Abrir ${label.toLowerCase()}`}><ExternalLink aria-hidden="true" />Abrir</a></Button>
        : <Button disabled><ExternalLink aria-hidden="true" />Abrir</Button>}
    </div>
  </div>;
}

export function StoreDashboardView({ store, summary, landing, orders, products }) {
  const basePath = storePath(store._id);
  const publicUrl = landing?.subdomain ? landingUrls(landing.subdomain).path : '';
  const published = Boolean(landing?.published);
  const available = published && store.status === 'active';
  const pendingChanges = published && JSON.stringify(landing.draft) !== JSON.stringify(landing.published);
  const checks = [
    { label: 'Oferta principal configurada', done: Boolean(store.offer.mainProductId), to: `${basePath}/productos` },
    { label: 'Landing publicada', done: published, to: `${basePath}/landing` },
    { label: 'Tienda activa', done: store.status === 'active', to: `${basePath}/configuracion` },
    { label: 'Meta Pixel configurado', done: Boolean(store.tracking.metaPixelId), optional: true, to: `${basePath}/configuracion` },
  ];

  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Tu espacio de venta</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{store.name}</h1>
        <p className="text-sm leading-6 text-muted-foreground">Tu oferta, tus links y la actividad de esta tienda, en un solo lugar.</p>
      </div>
      <Badge variant={available ? 'secondary' : 'outline'} className="px-3 py-1.5">{available ? 'Landing disponible' : 'En preparación'}</Badge>
    </div>

    <div className="dashboard-columns">
      <div className="space-y-6">
        <section className="dashboard-card overflow-hidden" aria-labelledby="share-heading">
          <div className="dashboard-welcome">
            <div className="max-w-xl space-y-4">
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase"><Sparkles className="size-4" aria-hidden="true" />Una campaña. Todo conectado.</span>
              <h2 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{available ? 'Tu landing ya está publicada.' : 'Dale forma a tu próxima venta.'}</h2>
              <p className="max-w-lg text-sm leading-7 text-muted-foreground">{available ? 'Compartí tu landing o llevá a tus compradores directamente al checkout. Administrá todo desde esta tienda.' : 'Configurá tu oferta, publicá la landing y activá la tienda para empezar a compartirla.'}</p>
              <Button asChild variant="outline"><Link to={`${basePath}/landing`}>{published ? 'Editar landing' : 'Preparar landing'}<ArrowRight aria-hidden="true" /></Link></Button>
            </div>
            <div className="dashboard-product" aria-hidden="true"><BookOpen strokeWidth={1.2} /><span>Tu ebook</span></div>
          </div>
          <div className="space-y-4 p-5 sm:p-7">
            <h2 id="share-heading" className="flex items-center gap-2 text-sm font-semibold"><Link2 className="size-4 text-primary" aria-hidden="true" />Tus links para compartir</h2>
            <ShareLink key={`landing-${publicUrl}`} label="Landing de la tienda" url={publicUrl} icon={Globe} enabled={available} />
            <ShareLink key={`checkout-${publicUrl}`} label="Checkout" url={publicUrl ? `${publicUrl}/checkout` : ''} icon={ShoppingCart} enabled={available} />
            {!available && <p className="text-xs leading-6 text-muted-foreground">Los links se habilitan cuando la tienda está activa y la landing está publicada. <Link to={`${basePath}/${published ? 'configuracion' : 'landing'}`} className="font-medium underline underline-offset-4">Completar configuración</Link></p>}
            {pendingChanges && <p className="text-xs leading-6 text-muted-foreground">Tenés cambios guardados sin publicar. Los links muestran la última versión publicada.</p>}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de la oferta">
          {[
            { label: 'Producto principal', value: formatMoney(store.offer.price, store.currency), path: 'productos', detail: summary?.mainProductName || 'Ebook principal', icon: BookOpen },
            { label: 'Bonos incluidos', value: store.offer.bonuses.length, path: 'productos#bonos', detail: 'Sin costo adicional', icon: Gift },
            { label: 'Extras en checkout', value: store.offer.upsells.length, path: 'productos#upsells', detail: 'Opcionales para el comprador', icon: Tag },
          ].map(({ label, value, detail, icon: Icon, path }) => <Link key={label} to={`${basePath}/${path}`} className="dashboard-card space-y-4 p-5 transition-colors hover:border-ring">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{label}</span><Icon className="size-4" aria-hidden="true" /></div>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
          </Link>)}
        </section>
        <StoreOfferSummary store={store} products={products} />
        <LandingContentSummary landing={landing} storeId={store._id} />
      </div>

      <div className="space-y-6">
        <section className="dashboard-card p-5 sm:p-6" aria-labelledby="activity-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="activity-heading" className="text-base font-semibold">Actividad reciente</h2>
            <Link to={`${basePath}/cobros`} className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary">Ver todo<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          </div>
          {orders === undefined ? <div className="pt-4"><PageSkeleton label="Cargando actividad" /></div> : orders.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
            <span className="dashboard-icon"><ShoppingCart aria-hidden="true" /></span>
            <p className="text-sm font-medium">Todavía no hay compras</p>
            <p className="max-w-52 text-xs leading-6 text-muted-foreground">Las compras de esta tienda aparecerán acá.</p>
          </div> : <ul className="divide-y">{orders.slice(0, 5).map(order => <li key={order._id} className="space-y-2 py-4">
            <div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate text-sm font-medium">{order.buyer?.name || order.buyer?.email || 'Compra iniciada'}</p><span className="shrink-0 text-sm font-semibold">{formatMoney(order.total, order.currency)}</span></div>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span><Badge variant={statusVariant(order.status)}>{STATUS_LABELS[order.status]}</Badge></div>
          </li>)}</ul>}
        </section>

        <section className="dashboard-card space-y-5 p-5 sm:p-6" aria-labelledby="setup-heading">
          <div><h2 id="setup-heading" className="text-base font-semibold">Tu tienda, paso a paso</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">Los básicos de tu campaña.</p></div>
          <ul className="space-y-1">{checks.map(item => <li key={item.label}><Link to={item.to} className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm hover:bg-accent">
            {item.done ? <CircleCheck className="size-5 shrink-0 text-primary" aria-hidden="true" /> : <CircleDashed className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className="flex-1">{item.label}{item.optional && <span className="block text-xs text-muted-foreground">Opcional</span>}</span>
            <span className="sr-only">{item.done ? 'Completado' : 'Pendiente'}</span><ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </Link></li>)}</ul>
        </section>
      </div>
    </div>
  </div>;
}

export default function StoreDashboardPage() {
  const { storeId } = useParams();
  const { store: summary } = useStoreWorkspace();
  const store = useQuery(api.stores.get, { id: storeId });
  const landing = useQuery(api.landings.getForStore, { storeId });
  const products = useQuery(api.products.list, {});
  const orders = useQuery(api.orders.list, { storeId });
  if (store === undefined || landing === undefined || products === undefined) return <PageSkeleton label="Cargando inicio de la tienda" />;
  if (!store) return <EmptyState title="Esta tienda ya no está disponible"><Link to="/panel/tiendas">Ver tiendas</Link></EmptyState>;
  return <StoreDashboardView key={storeId} store={store} summary={summary} landing={landing} orders={orders} products={products} />;
}

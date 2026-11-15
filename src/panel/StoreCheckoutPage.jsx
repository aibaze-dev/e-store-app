import { ACTIVITY_DEFAULTS } from '../../shared/landing-copy.js';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { Check, LoaderCircle, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText, formatMoney, fromMinor, toMinor } from '@/lib/format.js';
import { landingUrls } from '@/lib/site.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';
import { ShareLink } from './StoreDashboardPage.jsx';
import StoreOfferSummary from './StoreOfferSummary.jsx';

// What the public checkout shows besides the offer. None of it changes what is charged.
function CheckoutSettings({ store, products, landingNotifications }) {
  const save = useMutation(api.stores.updateCheckout);
  const upsells = [...store.offer.upsells].sort((a, b) => a.displayOrder - b.displayOrder);
  const [form, setForm] = useState(() => ({
    notifications: store.checkout?.notifications ?? landingNotifications,
    liveVisitors: store.checkout?.liveVisitors ?? false,
    upsellTitle: store.checkout?.upsellTitle ?? '',
    references: Object.fromEntries((store.checkout?.upsellReferences ?? []).map(reference => [reference.productId, fromMinor(reference.value, store.currency)])),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = change => { setSaved(false); setForm(current => ({ ...current, ...change })); };

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setSaved(false);
    const upsellReferences = [];
    for (const upsell of upsells) {
      const text = form.references[upsell.productId]?.trim();
      if (!text) continue;
      const value = toMinor(text, store.currency);
      if (!Number.isInteger(value) || value <= upsell.price) { setError('El precio de referencia de un extra debe ser mayor a su precio de venta.'); return; }
      upsellReferences.push({ productId: upsell.productId, value });
    }
    setBusy(true);
    try {
      await save({ id: store._id, checkout: { notifications: form.notifications, liveVisitors: form.liveVisitors, upsellTitle: form.upsellTitle, upsellReferences } });
      setSaved(true);
    } catch (failure) { setError(errorText(failure, 'No se pudieron guardar los ajustes. Volvé a intentar.')); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="dashboard-card space-y-6 p-5 sm:p-7" aria-busy={busy}>
    <div><h2 className="text-lg font-semibold">Ajustes del checkout</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Cómo se presenta la compra. Se aplican al guardar, sin volver a publicar la landing, y no cambian lo que se cobra.</p></div>
    <div className="space-y-2">
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-5 accent-primary" checked={form.notifications} onChange={event => set({ notifications: event.target.checked })} disabled={busy} />Mostrar avisos de compra simulados (demo)</label>
      <p className="text-xs leading-5 text-muted-foreground">Nombres y ciudades ficticios, con pausas aleatorias y el texto «Ejemplo de compra del ebook». Funcionan sin ventas y no generan órdenes, cobros ni métricas. Hasta guardar ajustes propios del checkout, se usa la activación de avisos de la landing publicada.</p>
    </div>
    <div className="space-y-2">
      <p className="text-sm font-medium">Actividad y contador simulados</p>
      <p className="text-xs leading-5 text-muted-foreground">Por ahora, el checkout muestra entre 2 y 15 personas y cambia cada 15 segundos. El contador arranca al azar entre 8:01 y 14:59 y conserva el tiempo al recargar esta pestaña. Todavía no está conectado a actividad real ni al vencimiento de la oferta.</p>
    </div>
    <Field label="Título del bloque de extras" hint="Si queda vacío, usamos «Sumá a tu compra».">{props => <Input {...props} value={form.upsellTitle} onChange={event => set({ upsellTitle: event.target.value })} maxLength={60} placeholder="Sumá a tu compra" disabled={busy} />}</Field>
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold">Precio de referencia de cada extra (opcional)</legend>
      <p className="text-xs leading-5 text-muted-foreground">Se muestra tachado junto al precio del extra, con el porcentaje de descuento. Usá el precio real al que lo vendés por separado.</p>
      {upsells.length === 0 && <p className="text-sm text-muted-foreground">Esta tienda no ofrece extras. <Link to={`/panel/tiendas/${store._id}/productos#upsells`} className="underline underline-offset-4">Agregá uno en Productos y oferta</Link>.</p>}
      {upsells.map(upsell => <Field key={upsell.productId} label={`${products.find(product => product._id === upsell.productId)?.name || 'Producto no disponible'} · se vende a ${formatMoney(upsell.price, store.currency)}`}>
        {props => <Input {...props} className="max-w-48" inputMode="decimal" placeholder="0.00" value={form.references[upsell.productId] || ''} onChange={event => set({ references: { ...form.references, [upsell.productId]: event.target.value } })} disabled={busy} />}
      </Field>)}
    </fieldset>
    <ErrorAlert>{error}</ErrorAlert>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Guardando…' : 'Guardar ajustes'}</Button>
      <p className="text-sm text-muted-foreground" role="status">{saved && <span className="inline-flex items-center gap-2"><Check className="size-4" aria-hidden="true" />Ajustes guardados.</span>}</p>
    </div>
  </form>;
}

export default function StoreCheckoutPage() {
  const { storeId } = useParams();
  const store = useQuery(api.stores.get, { id: storeId });
  const landing = useQuery(api.landings.getForStore, { storeId });
  const products = useQuery(api.products.list, {});
  if (store === undefined || landing === undefined || products === undefined) return <PageSkeleton label="Cargando checkout" />;
  if (!store) return <EmptyState title="Esta tienda ya no está disponible" />;
  const available = store.status === 'active' && Boolean(landing?.published);
  const url = landing?.subdomain ? `${landingUrls(landing.subdomain).path}/checkout` : '';
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight">Checkout</h1><p className="text-sm leading-7 text-muted-foreground">El checkout de {store.name}. Incluye el producto principal y los bonos gratis; cada comprador elige sus extras.</p></div>
    <section className="dashboard-card space-y-4 p-5 sm:p-7"><ShareLink key={url} label="Checkout" url={url} icon={ShoppingCart} enabled={available} />{!available && <p className="text-sm text-muted-foreground">Activá la tienda y <Link to={`/panel/tiendas/${storeId}/landing`} className="underline underline-offset-4">publicá la landing</Link> para habilitar el checkout.</p>}</section>
    <CheckoutSettings key={store._id} store={store} products={products} landingNotifications={landing?.published?.activity?.notifications ?? ACTIVITY_DEFAULTS.notifications} />
    <StoreOfferSummary store={store} products={products} />
    <p className="text-sm leading-7 text-muted-foreground">El total se calcula con el producto principal y los extras elegidos. La oferta post-compra es opcional y se cobra en un segundo pago. Después de pagar, el comprador recibe sus links en pantalla.</p>
  </div>;
}

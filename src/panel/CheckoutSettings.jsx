import { useStoreWorkspace } from './StoreWorkspace.jsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { Check, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorAlert, Field } from '@/components/Field.jsx';

// What the public checkout shows besides the offer. None of it changes what is charged.
export default function CheckoutSettings({ store, products, landingNotifications }) {
  const { productsPath } = useStoreWorkspace();
  const save = useMutation(api.stores.updateCheckout);
  const upsells = [...store.offer.upsells].sort((a, b) => a.displayOrder - b.displayOrder);
  const [form, setForm] = useState(() => ({
    notifications: store.checkout?.notifications ?? landingNotifications,
    liveVisitors: store.checkout?.liveVisitors ?? false,
    upsellTitle: store.checkout?.upsellTitle ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = change => { setSaved(false); setForm(current => ({ ...current, ...change })); };

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setSaved(false);
    const upsellReferences = store.checkout?.upsellReferences ?? [];
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Presentación de los productos</h3>
      <p className="text-xs leading-5 text-muted-foreground">La portada, descripción corta y precio de referencia se editan en el producto y se reutilizan en la landing y el checkout.</p>
      {upsells.map(upsell => <p key={upsell.productId} className="text-sm"><Link className="underline underline-offset-4" to={`${productsPath}/${upsell.productId}`}>Editar {products.find(product => product._id === upsell.productId)?.name || 'producto'}</Link></p>)}
      <Link className="text-sm underline underline-offset-4" to={`/panel/tiendas/${store._id}/productos#upsells`}>Elegir extras y precios de venta</Link>
    </div>
    <ErrorAlert>{error}</ErrorAlert>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Guardando…' : 'Guardar ajustes'}</Button>
      <p className="text-sm text-muted-foreground" role="status">{saved && <span className="inline-flex items-center gap-2"><Check className="size-4" aria-hidden="true" />Ajustes guardados.</span>}</p>
    </div>
  </form>;
}


import { useState } from 'react';
import { useConvex, useMutation } from 'convex/react';
import { Copy, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ErrorAlert, Field } from '@/components/Field.jsx';

// Alternative to the AI wizard: start from the published landing of another store.
// The server copies that landing as this store's draft together with what the store sells.
export default function LandingClone({ storeId, hasContent, disabled, onApply, variant = 'outline' }) {
  const convex = useConvex();
  const cloneFrom = useMutation(api.landings.cloneFrom);
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState(null);
  const [sourceId, setSourceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function show() {
    setOpen(true); setError(''); setLoading(true);
    try {
      const list = await convex.query(api.landings.cloneSources, { storeId });
      setSources(list); setSourceId(current => list.some(item => item.storeId === current) ? current : list[0]?.storeId ?? '');
    } catch (failure) { setError(errorText(failure, 'No se pudieron cargar las tiendas. Volvé a intentar.')); }
    finally { setLoading(false); }
  }

  async function submit(event) {
    // The dialog is portaled, but React still bubbles submit to the wizard's form around the button.
    event.preventDefault(); event.stopPropagation();
    if (busy || !sourceId) return;
    setBusy(true); setError('');
    try {
      await onApply(await cloneFrom({ storeId, sourceStoreId: sourceId }));
      setOpen(false);
    } catch (failure) { setError(errorText(failure, 'No se pudo copiar la landing. Volvé a intentar.')); }
    finally { setBusy(false); }
  }

  return <>
    <Button type="button" variant={variant} disabled={disabled} onClick={show}><Copy aria-hidden="true" />Iniciar desde landing de otra tienda</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-w-xl" closeLabel="Cerrar copia de landing">
        <div className="space-y-2 pr-8">
          <DialogTitle className="text-xl">Iniciá desde la landing de otra tienda</DialogTitle>
          <DialogDescription className="text-sm leading-6">Copiamos todo: la landing publicada (textos, fotos, videos, testimonios, colores, secciones, promoción, avisos, checkout y post-compra) y lo que vende esa tienda: moneda, producto, precio, bonos, extras, oferta post-compra, downsell y ajustes del checkout.</DialogDescription>
        </div>
        <form className="space-y-3" onSubmit={submit} aria-busy={busy}>
          {loading
            ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Buscando tiendas con landing publicada…</p>
            : sources?.length === 0
              ? <p className="text-sm text-muted-foreground">Todavía no hay otras tiendas con una landing publicada. Podés generarla con IA o pegar un JSON.</p>
              : sources && <Field label="Tienda de origen">{ids => <NativeSelect {...ids} value={sourceId} disabled={busy} onChange={event => setSourceId(event.target.value)}>
                {sources.map(item => <option key={item.storeId} value={item.storeId}>{item.name}{item.subdomain ? ` · ${item.subdomain}` : ''}{item.title ? ` · ${item.title.replace(/\s+/g, ' ').slice(0, 60)}` : ''}</option>)}
              </NativeSelect>}</Field>}
          <p className="text-xs leading-5 text-muted-foreground">Esta tienda conserva su nombre, su subdominio, su estado y sus pixeles de Meta. {hasContent ? 'Se reemplazan la landing actual (incluidos los cambios sin guardar) y la oferta de esta tienda. ' : 'Se reemplaza la oferta actual de esta tienda. '}La oferta se aplica al guardar; la landing queda como borrador y no se publica hasta que vos lo decidas. La otra tienda no cambia.</p>
          <ErrorAlert>{error}</ErrorAlert>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy || loading || !sourceId}>{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Copy aria-hidden="true" />}{busy ? 'Copiando…' : hasContent ? 'Reemplazar con esta landing' : 'Copiar landing'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

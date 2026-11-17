import { ImageField, FileField, UploadContext, useMediaUpload } from './ImageField.jsx';
import { useStoreWorkspace } from './StoreWorkspace.jsx';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api.js';
import business from '@/config/businessData.json';
import { errorText, fromMinor, toMinor } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';

const EMPTY = { shortDescription: '', featured: false, referenceConfigured: true, referenceAmount: '', referenceCurrency: business.currency, name: '', description: '', coverUrl: '', status: 'active', deliverables: [{ title: '', url: '' }] };

export default function ProductFormPage() {
  const { productsPath } = useStoreWorkspace();
  const { productId } = useParams();
  const navigate = useNavigate();
  const existing = useQuery(api.products.get, productId ? { id: productId } : 'skip');
  const create = useMutation(api.products.create);
  const update = useMutation(api.products.update);
  const [form, setForm] = useState(productId ? null : EMPTY);
  const [saving, setBusy] = useState(false);
  const upload = useMediaUpload();
  const busy = saving || upload.pending;
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing && !form) {
      const { name, description, coverUrl, status, deliverables } = existing;
      setForm({ name, description, coverUrl, status, deliverables, shortDescription: existing.shortDescription ?? '', featured: existing.featured ?? false, referenceConfigured: existing.referencePrice !== undefined, referenceAmount: fromMinor(existing.referencePrice?.value, existing.referencePrice?.currency || business.currency), referenceCurrency: existing.referencePrice?.currency || business.currency });
    }
  }, [existing, form]);

  if (productId && existing === null) return <EmptyState title="Este producto ya no existe">
    <Button asChild variant="outline"><Link to={productsPath}>Volver a productos</Link></Button>
  </EmptyState>;
  if (!form) return <PageSkeleton label="Cargando producto" />;

  const set = change => setForm(current => ({ ...current, ...change }));
  const setLink = (index, change) => set({ deliverables: form.deliverables.map((link, i) => (i === index ? { ...link, ...change } : link)) });

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { referenceConfigured, referenceAmount, referenceCurrency, ...data } = form;
      if (referenceConfigured) {
        const value = referenceAmount.trim() ? toMinor(referenceAmount, referenceCurrency) : null;
        if (value !== null && (!Number.isInteger(value) || value <= 0)) { setError('Ingresá un precio de referencia válido o dejalo vacío.'); setBusy(false); return; }
        data.referencePrice = value === null ? null : { currency: referenceCurrency, value };
      }
      if (productId) await update({ id: productId, ...data });
      else await create(data);
      navigate(productsPath);
    } catch (failure) { setError(errorText(failure, 'No se pudo guardar el producto. Volvé a intentar.')); setBusy(false); }
  }

  return <UploadContext.Provider value={upload}><form onSubmit={submit} className="mx-auto max-w-3xl space-y-6" aria-busy={busy}>
    <div className="space-y-3">
      <Button asChild variant="ghost" className="-ml-3"><Link to={productsPath}><ArrowLeft aria-hidden="true" />Productos</Link></Button>
      <h1 className="text-3xl font-semibold tracking-tight">{productId ? 'Editar producto' : 'Nuevo producto'}</h1>
    </div>

    <Card>
      <CardHeader><CardTitle>Datos del recurso</CardTitle><CardDescription>Este recurso es compartido. Sus cambios se reflejan en las landings y los checkouts de todas las tiendas que lo usan.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <Field label="Nombre">{props => <Input {...props} value={form.name} onChange={event => set({ name: event.target.value })} maxLength={120} required disabled={busy} />}</Field>
        <Field label="Descripción">{props => <Textarea {...props} value={form.description} onChange={event => set({ description: event.target.value })} maxLength={2000} disabled={busy} />}</Field>
        <ImageField label="Portada" value={form.coverUrl} onChange={coverUrl => set({ coverUrl })} disabled={busy} hint="Opcional. Subí la portada del producto." />
        <Field label="Estado" hint="Un producto archivado deja de ofrecerse al armar tiendas nuevas; las tiendas que ya lo usan no cambian.">{props => <NativeSelect {...props} value={form.status} onChange={event => set({ status: event.target.value })} disabled={busy}>
          <option value="active">Activo</option><option value="archived">Archivado</option>
        </NativeSelect>}</Field>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Presentación en la compra</CardTitle><CardDescription>Estos datos se reutilizan en todas las tiendas. El precio de venta y los extras incluidos se eligen en Productos y oferta de cada tienda.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <Field label="Descripción corta" hint="Opcional. Se usa en las tarjetas de compra; si queda vacía, se muestra la descripción del producto.">{props => <Textarea {...props} value={form.shortDescription} onChange={event => set({ shortDescription: event.target.value })} maxLength={180} disabled={busy} />}</Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Precio de referencia" hint="Precio real de venta por separado. Se muestra tachado y calcula el descuento cuando supera el precio de la oferta.">{props => <Input {...props} inputMode="decimal" value={form.referenceAmount} placeholder="Opcional" onChange={event => set({ referenceAmount: event.target.value, referenceConfigured: true })} disabled={busy} />}</Field>
          <Field label="Moneda" hint="Solo se aplica a tiendas con esta moneda.">{props => <Input {...props} value={form.referenceCurrency} maxLength={3} autoCapitalize="characters" onChange={event => set({ referenceCurrency: event.target.value.toUpperCase(), referenceConfigured: true })} disabled={busy} />}</Field>
        </div>
        {!form.referenceConfigured && <p className="text-xs text-muted-foreground">Este producto conserva los precios de referencia anteriores de cada tienda hasta que configures este campo.</p>}
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-5 accent-primary" checked={form.featured} onChange={event => set({ featured: event.target.checked })} disabled={busy} />Destacar este producto en el combo</label>
        <p className="text-xs text-muted-foreground">Resalta el borde de su tarjeta. El comprador sigue eligiendo si lo agrega.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Entregables</CardTitle><CardDescription>Subí los archivos que recibe el comprador después de pagar. No se muestran en la landing.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {form.deliverables.length === 0 && <p className="text-sm text-muted-foreground">Sin entregables. Agregá al menos uno para poder vender este producto.</p>}
        {form.deliverables.map((link, index) => <fieldset key={index} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <legend className="sr-only">Entregable {index + 1}</legend>
          <Field label="Título">{props => <Input {...props} value={link.title} onChange={event => setLink(index, { title: event.target.value })} maxLength={120} required disabled={busy} />}</Field>
          <FileField label={`Archivo del entregable ${index + 1}`} value={link.url} onChange={url => setLink(index, { url })} disabled={busy} />
          <Button type="button" variant="outline" size="icon" disabled={busy} aria-label={`Quitar entregable ${index + 1}`} onClick={() => set({ deliverables: form.deliverables.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" /></Button>
        </fieldset>)}
        <Button type="button" variant="outline" disabled={busy || form.deliverables.length >= 30} onClick={() => set({ deliverables: [...form.deliverables, { title: '', url: '' }] })}><Plus aria-hidden="true" />Agregar entregable</Button>
      </CardContent>
    </Card>

    <ErrorAlert>{error}</ErrorAlert>
    <div className="flex flex-wrap gap-3">
      <Button type="submit" size="lg" disabled={busy}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{upload.pending ? 'Subiendo archivo…' : saving ? 'Guardando…' : 'Guardar producto'}</Button>
      <Button asChild variant="outline" size="lg"><Link to={productsPath}>Cancelar</Link></Button>
    </div>
  </form></UploadContext.Provider>;
}

import { ImageField, FileField, UploadContext, useMediaUpload } from './ImageField.jsx';
import { useStoreWorkspace } from './StoreWorkspace.jsx';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { artifacts } from '@/artifacts/registry.js';
import { artifactUrl } from '@/lib/site.js';
import { api } from '@/lib/api.js';
import business from '@/config/businessData.json';
import { errorText, fromMinor, toMinor } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';

const EMPTY = { shortDescription: '', featured: false, referenceConfigured: true, referenceAmount: '', referenceCurrency: business.currency, name: '', description: '', coverUrl: '', status: 'active', deliverables: [] };

export default function ProductFormPage({ artifactMode = false }) {
  const { productId, artifactSlug } = useParams();
  return <ProductForm key={artifactSlug || productId || 'new'} artifactMode={artifactMode} productId={productId} artifactSlug={artifactSlug} />;
}

function ProductForm({ artifactMode, productId, artifactSlug }) {
  const workspace = useStoreWorkspace();
  const productsPath = artifactMode ? '/panel/artefactos' : workspace.productsPath;
  const artifact = artifacts.find(item => item.slug === artifactSlug);
  const navigate = useNavigate();
  const product = useQuery(api.products.get, productId ? { id: productId } : 'skip');
  const artifactProduct = useQuery(api.products.getByArtifactSlug, artifactMode && artifact ? { slug: artifactSlug } : 'skip');
  const existing = artifactMode ? artifactProduct : product;
  const saveArtifact = useMutation(api.products.saveArtifact);
  const create = useMutation(api.products.create);
  const update = useMutation(api.products.update);
  const [form, setForm] = useState(productId || artifactMode ? null : EMPTY);
  const [saving, setBusy] = useState(false);
  const upload = useMediaUpload();
  const busy = saving || upload.pending;
  const [error, setError] = useState('');

  useEffect(() => {
    if (artifactMode && artifact && existing === null && !form) {
      setForm({ ...EMPTY, name: artifact.name, description: artifact.description, coverUrl: artifact.coverUrl || '' });
    }
    if (existing && !form) {
      const { name, description, coverUrl, status, deliverables } = existing;
      setForm({ name, description, coverUrl, status, deliverables, shortDescription: existing.shortDescription ?? '', featured: existing.featured ?? false, referenceConfigured: existing.referencePrice !== undefined, referenceAmount: fromMinor(existing.referencePrice?.value, existing.referencePrice?.currency || business.currency), referenceCurrency: existing.referencePrice?.currency || business.currency });
    }
  }, [existing, form, artifactMode, artifact]);

  if (!artifactMode && existing?.type === 'artifact') return <Navigate replace to={`/panel/artefactos/${existing.artifactSlug}`} />;
  if (artifactMode && !artifact) return <EmptyState title="Artefacto no encontrado"><Button asChild variant="outline"><Link to={productsPath}>Volver a artefactos</Link></Button></EmptyState>;
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
      if (artifactMode) {
        const { deliverables, ...presentation } = data;
        await saveArtifact({ slug: artifactSlug, ...presentation });
      } else if (productId) await update({ id: productId, ...data });
      else await create(data);
      navigate(productsPath);
    } catch (failure) { setError(errorText(failure, 'No se pudo guardar el producto. Volvé a intentar.')); setBusy(false); }
  }

  return <UploadContext.Provider value={upload}><form onSubmit={submit} className="mx-auto max-w-3xl space-y-6" aria-busy={busy}>
    <div className="space-y-3">
      <Button asChild variant="ghost" className="-ml-3"><Link to={productsPath}><ArrowLeft aria-hidden="true" />{artifactMode ? 'Artefactos' : 'Productos'}</Link></Button>
      <h1 className="text-3xl font-semibold tracking-tight">{artifactMode ? 'Ficha del artefacto' : productId ? 'Editar producto' : 'Nuevo producto'}</h1>
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
          <Field label="Precio normal (tachado)" hint="Se configura una vez en este producto. La landing y el checkout muestran este precio tachado y una etiqueta roja −X% OFF calculada contra el precio de venta de cada tienda. Ejemplo: normal US$18 y oferta US$9 → −50% OFF.">{props => <Input {...props} inputMode="decimal" value={form.referenceAmount} placeholder="Opcional" onChange={event => set({ referenceAmount: event.target.value, referenceConfigured: true })} disabled={busy} />}</Field>
          <Field label="Moneda" hint="Solo se aplica a tiendas con esta moneda.">{props => <Input {...props} value={form.referenceCurrency} maxLength={3} autoCapitalize="characters" onChange={event => set({ referenceCurrency: event.target.value.toUpperCase(), referenceConfigured: true })} disabled={busy} />}</Field>
        </div>
        {!form.referenceConfigured && <p className="text-xs text-muted-foreground">Este producto conserva los precios de referencia anteriores de cada tienda hasta que configures este campo.</p>}
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-5 accent-primary" checked={form.featured} onChange={event => set({ featured: event.target.checked })} disabled={busy} />Destacar este producto en el combo</label>
        <p className="text-xs text-muted-foreground">Resalta el borde de su tarjeta. El comprador sigue eligiendo si lo agrega.</p>
      </CardContent>
    </Card>

    {artifactMode ? <Card>
      <CardHeader><CardTitle>Entregable del artefacto</CardTitle><CardDescription>El comprador recibe este enlace al incluir el recurso como producto principal, bono gratis o upsell. Elegí su función y precio en Productos y oferta de cada tienda.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <Field label="Enlace público" hint="El enlace es fijo. Cambiar el nombre o la portada no modifica la herramienta ni su URL.">{props => <Input {...props} readOnly value={artifactUrl(artifactSlug)} onFocus={event => event.target.select()} />}</Field>
        <Button asChild variant="outline"><a href={artifactUrl(artifactSlug)} target="_blank" rel="noopener noreferrer">Abrir artefacto</a></Button>
        <p className="text-sm text-muted-foreground">La herramienta es pública para quien tenga el enlace. Archivarla retira el recurso de nuevas ofertas, pero no desactiva su página.</p>
      </CardContent>
    </Card> : <Card>
      <CardHeader><CardTitle>Entregables (opcional)</CardTitle><CardDescription>Podés guardar el producto sin entregables y agregarlos después. Subí un documento o pegá un enlace para el comprador; se entrega después del pago y no se muestra en la landing.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {form.deliverables.length === 0 && <p className="text-sm text-muted-foreground">Todavía no agregaste entregables. Podés guardar el producto así.</p>}
        {form.deliverables.map((link, index) => <fieldset key={index} className="grid min-w-0 gap-4 rounded-lg border p-4">
          <legend className="sr-only">Entregable {index + 1}</legend>
          <Field label="Título">{props => <Input {...props} value={link.title} onChange={event => setLink(index, { title: event.target.value })} maxLength={120} required disabled={busy} />}</Field>
          <Field label="Tipo de entregable">{props => <NativeSelect {...props} value={link.kind ?? 'file'} onChange={event => setLink(index, { kind: event.target.value, url: '' })} disabled={busy}>
            <option value="file">Documento</option><option value="link">Enlace</option>
          </NativeSelect>}</Field>
          {link.kind === 'link'
            ? <Field label={`Enlace del entregable ${index + 1}`} hint="Este enlace se comparte con el comprador después del pago.">{props => <Input {...props} type="url" value={link.url} placeholder="https://…" onChange={event => setLink(index, { url: event.target.value })} maxLength={2000} required disabled={busy} />}</Field>
            : <FileField label={`Documento del entregable ${index + 1}`} value={link.url} onChange={url => setLink(index, { url })} disabled={busy} />}
          <Button type="button" variant="outline" className="justify-self-start" disabled={busy} aria-label={`Quitar entregable ${index + 1}`} onClick={() => set({ deliverables: form.deliverables.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" />Quitar entregable</Button>
        </fieldset>)}
        <Button type="button" variant="outline" disabled={busy || form.deliverables.length >= 30} onClick={() => set({ deliverables: [...form.deliverables, { title: '', url: '', kind: 'file' }] })}><Plus aria-hidden="true" />Agregar entregable</Button>
      </CardContent>
    </Card>}

    <ErrorAlert>{error}</ErrorAlert>
    <div className="flex flex-wrap gap-3">
      <Button type="submit" size="lg" disabled={busy}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{upload.pending ? 'Subiendo archivo…' : saving ? 'Guardando…' : artifactMode ? 'Guardar ficha' : 'Guardar producto'}</Button>
      <Button asChild variant="outline" size="lg"><Link to={productsPath}>Cancelar</Link></Button>
    </div>
  </form></UploadContext.Provider>;
}

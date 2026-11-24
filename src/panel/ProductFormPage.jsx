import { ImageField, FileField, UploadContext, useMediaUpload } from './ImageField.jsx';
import { useStoreWorkspace } from './StoreWorkspace.jsx';
import { useEffect, useId, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { AppWindow, ArrowLeft, ArrowUpRight, FileText, Link2, LoaderCircle, PackageOpen, Plus, ShoppingBag, Sparkles, Star, Trash2, BookOpen } from 'lucide-react';
import { artifacts } from '@/artifacts/registry.js';
import { artifactUrl } from '@/lib/site.js';
import { api } from '@/lib/api.js';
import business from '@/config/businessData.json';
import { errorText, formatMoney, fromMinor, toMinor } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { EmptyState, ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';
import { CoverArt, SectionHeading, StatusPill, deliverableSummary } from './CatalogParts.jsx';
import { ViewContentButton } from './DeliverableViewer.jsx';

const EMPTY = { type: 'e-book', appUrl: '', shortDescription: '', featured: false, referenceConfigured: true, referenceAmount: '', referenceCurrency: business.currency, name: '', description: '', coverUrl: '', status: 'active', deliverables: [] };
const KINDS = [{ value: 'file', label: 'Documento', icon: FileText }, { value: 'link', label: 'Enlace', icon: Link2 }];
const STATUSES = [{ value: 'active', label: 'Activo' }, { value: 'archived', label: 'Archivado' }];
const TYPES = [{ value: 'e-book', label: 'Ebook', icon: BookOpen }, { value: 'app', label: 'App', icon: AppWindow }];

// Accessible segmented control built on native radios.
function Choice({ legend, value, options, onChange, disabled, srLegend = false }) {
  const name = useId();
  return <fieldset className="min-w-0 space-y-2.5">
    <legend className={cn('text-sm font-medium', srLegend && 'sr-only')}>{legend}</legend>
    <div className="catalog-segmented">{options.map(({ value: option, label, icon: Icon }) => <label key={option} className={cn(value === option && 'is-active')}>
      <input type="radio" className="sr-only" name={name} value={option} checked={value === option} onChange={() => onChange(option)} disabled={disabled} />
      {Icon && <Icon className="size-4" aria-hidden="true" />}{label}
    </label>)}</div>
  </fieldset>;
}

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
      const app = existing.type === 'app';
      setForm({ name, description, coverUrl, status, type: app ? 'app' : 'e-book', appUrl: app ? deliverables[0]?.url ?? '' : '', deliverables: app ? [] : deliverables, shortDescription: existing.shortDescription ?? '', featured: existing.featured ?? false, referenceConfigured: existing.referencePrice !== undefined, referenceAmount: fromMinor(existing.referencePrice?.value, existing.referencePrice?.currency || business.currency), referenceCurrency: existing.referencePrice?.currency || business.currency });
    }
  }, [existing, form, artifactMode, artifact]);

  if (!artifactMode && existing?.type === 'artifact') return <Navigate replace to={`/panel/artefactos/${existing.artifactSlug}`} />;
  if (artifactMode && !artifact) return <EmptyState title="Artefacto no encontrado"><Button asChild variant="outline"><Link to={productsPath}>Volver a artefactos</Link></Button></EmptyState>;
  if (productId && existing === null) return <EmptyState title="Este producto ya no existe">
    <Button asChild variant="outline"><Link to={productsPath}>Volver al catálogo</Link></Button>
  </EmptyState>;
  if (!form) return <PageSkeleton label={artifactMode ? 'Cargando artefacto' : 'Cargando producto'} />;

  const set = change => setForm(current => ({ ...current, ...change }));
  const setItem = (index, change) => set({ deliverables: form.deliverables.map((item, i) => (i === index ? { ...item, ...change } : item)) });
  const addItem = kind => set({ deliverables: [...form.deliverables, { title: '', url: '', kind }] });
  const full = form.deliverables.length >= 30;
  const previewPrice = form.referenceAmount.trim() ? toMinor(form.referenceAmount, form.referenceCurrency) : NaN;
  const app = !artifactMode && form.type === 'app';
  const noun = artifactMode ? 'artefacto' : app ? 'app' : 'ebook';
  // Spanish gender of the noun, for the sentences that use it.
  const one = app ? 'Una' : 'Un';
  const archived = app ? 'archivada' : 'archivado';
  const untitled = app ? 'App sin título' : 'Ebook sin título';

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { referenceConfigured, referenceAmount, referenceCurrency, appUrl, ...data } = form;
      // An app is a product whose only deliverable is its link.
      if (data.type === 'app') data.deliverables = [{ title: data.name, url: appUrl, kind: 'link' }];
      if (referenceConfigured) {
        const value = referenceAmount.trim() ? toMinor(referenceAmount, referenceCurrency) : null;
        if (value !== null && (!Number.isInteger(value) || value <= 0)) { setError('Ingresá un precio de referencia válido o dejalo vacío.'); setBusy(false); return; }
        data.referencePrice = value === null ? null : { currency: referenceCurrency, value };
      }
      if (artifactMode) {
        const { deliverables, type, ...presentation } = data;
        await saveArtifact({ slug: artifactSlug, ...presentation });
      } else if (productId) await update({ id: productId, ...data });
      else await create(data);
      navigate(productsPath);
    } catch (failure) { setError(errorText(failure, `No se pudo guardar el ${noun}. Volvé a intentar.`)); setBusy(false); }
  }

  const actions = <div className="flex flex-col gap-2">
    <ErrorAlert>{error}</ErrorAlert>
    <Button type="submit" size="lg" disabled={busy}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{upload.pending ? 'Subiendo archivo…' : saving ? 'Guardando…' : artifactMode ? 'Guardar ficha' : productId ? 'Guardar cambios' : `Crear ${noun}`}</Button>
    <Button asChild variant="ghost" size="lg"><Link to={productsPath}>Cancelar</Link></Button>
  </div>;

  return <UploadContext.Provider value={upload}><form onSubmit={submit} className="space-y-6" aria-busy={busy}>
    <div className="space-y-4">
      <Button asChild variant="ghost" className="-ml-3"><Link to={productsPath}><ArrowLeft aria-hidden="true" />{artifactMode ? 'Artefactos' : 'Catálogo'}</Link></Button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary uppercase">{artifactMode ? <Sparkles className="size-4" aria-hidden="true" /> : app ? <AppWindow className="size-4" aria-hidden="true" /> : <BookOpen className="size-4" aria-hidden="true" />}{artifactMode ? 'Ficha del artefacto' : `${productId ? 'Editar' : app ? 'Nueva' : 'Nuevo'} ${noun}`}</p>
          <h1 className="text-3xl font-semibold tracking-tight break-words sm:text-4xl">{form.name.trim() || (artifactMode ? artifact.name : untitled)}</h1>
        </div>
        <StatusPill status={form.status} configured={!artifactMode || existing !== null} />
      </div>
    </div>

    <div className="catalog-detail">
      <div className="min-w-0 space-y-6">
        <section className="catalog-panel" aria-labelledby="section-data">
          <SectionHeading id="section-data" step={1} title={artifactMode ? 'Datos de la herramienta' : app ? 'Datos de la app' : 'Datos del ebook'} description="Es un recurso compartido: los cambios se reflejan en las landings y los checkouts de todas las tiendas que lo usan." />
          {!artifactMode && <div className="space-y-2">
            <Choice legend="Tipo de producto" value={form.type} options={TYPES} onChange={type => set({ type })} disabled={busy} />
            <p className="text-xs leading-5 text-muted-foreground">{app ? 'Una web-app fuera de esta plataforma: el comprador recibe su link y la app valida el acceso.' : 'Documentos o enlaces que el comprador recibe después del pago.'}</p>
          </div>}
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
            <div className="space-y-5">
              <Field label="Nombre">{props => <Input {...props} value={form.name} onChange={event => set({ name: event.target.value })} maxLength={120} required disabled={busy} />}</Field>
              <Field label="Descripción">{props => <Textarea {...props} rows={5} value={form.description} onChange={event => set({ description: event.target.value })} maxLength={2000} disabled={busy} />}</Field>
            </div>
            <ImageField label="Portada" value={form.coverUrl} onChange={coverUrl => set({ coverUrl })} disabled={busy} uploadOnly hint={`Opcional. Se muestra en la landing, el checkout y este panel.`} />
          </div>
          <div className="space-y-2">
            <Choice legend="Estado" value={form.status} options={STATUSES} onChange={status => set({ status })} disabled={busy} />
            <p className="text-xs leading-5 text-muted-foreground">{one} {noun} {archived} deja de ofrecerse al armar tiendas nuevas; las tiendas que ya lo usan no cambian.</p>
          </div>
        </section>

        <section className="catalog-panel" aria-labelledby="section-sale">
          <SectionHeading id="section-sale" step={2} title="Presentación en la compra" description="Se reutiliza en todas las tiendas. El precio de venta y los extras incluidos se eligen en Productos y oferta de cada tienda." />
          <Field label="Descripción corta" hint="Opcional. Se usa en las tarjetas de compra; si queda vacía, se muestra la descripción completa.">{props => <Textarea {...props} value={form.shortDescription} onChange={event => set({ shortDescription: event.target.value })} maxLength={180} disabled={busy} />}</Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Precio normal (tachado)" hint="La landing y el checkout lo muestran tachado con una etiqueta −X% OFF calculada contra el precio de venta de cada tienda. Ejemplo: normal US$18 y oferta US$9 → −50% OFF.">{props => <Input {...props} inputMode="decimal" value={form.referenceAmount} placeholder="Opcional" onChange={event => set({ referenceAmount: event.target.value, referenceConfigured: true })} disabled={busy} />}</Field>
            <Field label="Moneda" hint="Solo para tiendas con esta moneda.">{props => <Input {...props} value={form.referenceCurrency} maxLength={3} autoCapitalize="characters" onChange={event => set({ referenceCurrency: event.target.value.toUpperCase(), referenceConfigured: true })} disabled={busy} />}</Field>
          </div>
          {!form.referenceConfigured && <p className="text-xs text-muted-foreground">{app ? 'Esta' : 'Este'} {noun} conserva los precios de referencia anteriores de cada tienda hasta que configures este campo.</p>}
          <div className="catalog-toggle">
            <Star className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <label htmlFor="featured" className="text-sm font-medium">Destacar en el combo</label>
              <p id="featured-hint" className="text-xs leading-5 text-muted-foreground">Resalta el borde de su tarjeta. El comprador sigue eligiendo si lo agrega.</p>
            </div>
            <Switch id="featured" aria-describedby="featured-hint" checked={form.featured} onCheckedChange={featured => set({ featured })} disabled={busy} />
          </div>
        </section>

        {artifactMode ? <section className="catalog-panel" aria-labelledby="section-delivery">
          <SectionHeading id="section-delivery" step={3} title="Entrega de la herramienta" description="El comprador recibe este enlace al incluir el recurso como producto principal, bono gratis o upsell." />
          <div className="catalog-deliverable">
            <span className="catalog-step" aria-hidden="true"><Link2 /></span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Enlace público</p>
              <p className="text-sm font-medium break-all select-all">{artifactUrl(artifactSlug)}</p>
            </div>
            <Button asChild variant="outline"><a href={artifactUrl(artifactSlug)} target="_blank" rel="noopener noreferrer">Abrir<ArrowUpRight aria-hidden="true" /><span className="sr-only"> el artefacto en otra pestaña</span></a></Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">El enlace es fijo: cambiar el nombre o la portada no modifica la herramienta ni su URL. Es pública para quien tenga el enlace; archivarla la retira de nuevas ofertas, pero no desactiva su página.</p>
        </section> : app ? <section className="catalog-panel" aria-labelledby="section-delivery">
          <SectionHeading id="section-delivery" step={3} title="Link de la app" description="Lo que recibe el comprador después del pago, en el email de entrega y en la página de gracias. No se muestra en la landing." />
          <Field label="Link de la app" hint="La app decide quién entra: consulta POST /api/orders/paid-exists con el ID de la tienda (está en la URL del panel, /panel/tiendas/<id>) y el email del comprador.">{props => <Input {...props} type="url" value={form.appUrl} placeholder="https://…" onChange={event => set({ appUrl: event.target.value })} maxLength={2000} required disabled={busy} />}</Field>
          {/^https?:\/\//.test(form.appUrl.trim()) && <Button asChild variant="outline" className="self-start"><a href={form.appUrl.trim()} target="_blank" rel="noopener noreferrer">Abrir<ArrowUpRight aria-hidden="true" /><span className="sr-only"> la app en otra pestaña</span></a></Button>}
        </section> : <section className="catalog-panel" aria-labelledby="section-delivery">
          <SectionHeading id="section-delivery" step={3} title="Entregables" description="Lo que recibe el comprador después del pago. No se muestra en la landing. Podés guardar el ebook sin entregables y sumarlos después." />
          {form.deliverables.length === 0 ? <div className="catalog-dropzone">
            <PackageOpen className="size-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-sm font-medium">Todavía no agregaste entregables</p>
            <p className="max-w-sm text-xs leading-5 text-muted-foreground">Subí el PDF del ebook, plantillas o cualquier documento. También podés sumar un enlace externo.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Button type="button" disabled={busy} onClick={() => addItem('file')}><FileText aria-hidden="true" />Agregar documento</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => addItem('link')}><Link2 aria-hidden="true" />Agregar enlace</Button>
            </div>
          </div> : <>
            <ol className="space-y-4">{form.deliverables.map((item, index) => {
              const kind = item.kind ?? 'file';
              const KindIcon = kind === 'link' ? Link2 : FileText;
              return <li key={index}><fieldset className="catalog-deliverable is-editable">
                <legend className="sr-only">Entregable {index + 1}</legend>
                <div className="flex w-full flex-wrap items-center gap-3">
                  <span className="catalog-step" aria-hidden="true"><KindIcon /></span>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{item.title.trim() || `Entregable ${index + 1}`}</p>
                  <div className="order-last w-full sm:order-none sm:w-auto"><Choice legend={`Tipo del entregable ${index + 1}`} srLegend value={kind} options={KINDS} onChange={next => setItem(index, { kind: next, url: '' })} disabled={busy} /></div>
                  <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground hover:text-destructive" disabled={busy} aria-label={`Quitar entregable ${index + 1}`} onClick={() => set({ deliverables: form.deliverables.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" /></Button>
                </div>
                <div className="grid w-full gap-4">
                  <Field label="Título">{props => <Input {...props} value={item.title} placeholder={kind === 'link' ? 'Ej.: Comunidad privada' : 'Ej.: Ebook en PDF'} onChange={event => setItem(index, { title: event.target.value })} maxLength={120} required disabled={busy} />}</Field>
                  {kind === 'link'
                    ? <Field label={`Enlace del entregable ${index + 1}`} hint="Se comparte con el comprador después del pago.">{props => <Input {...props} type="url" value={item.url} placeholder="https://…" onChange={event => setItem(index, { url: event.target.value })} maxLength={2000} required disabled={busy} />}</Field>
                    : <FileField label={`Documento del entregable ${index + 1}`} value={item.url} onChange={url => setItem(index, { url })} disabled={busy} />}
                </div>
              </fieldset></li>;
            })}</ol>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy || full} onClick={() => addItem('file')}><Plus aria-hidden="true" />Agregar documento</Button>
              <Button type="button" variant="ghost" disabled={busy || full} onClick={() => addItem('link')}><Plus aria-hidden="true" />Agregar enlace</Button>
            </div>
            {full && <p className="text-xs text-muted-foreground">Llegaste al máximo de 30 entregables.</p>}
          </>}
        </section>}
      </div>

      <aside className="catalog-aside" aria-label="Vista previa y acciones">
        <div className="catalog-panel gap-4 p-4">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"><ShoppingBag className="size-3.5" aria-hidden="true" />Así se ve en la compra</p>
          <div className={cn('catalog-preview', form.featured && 'is-featured')}>
            <CoverArt src={form.coverUrl} title={form.name} variant={artifactMode || app ? 'tool' : 'book'} className="catalog-preview-cover" />
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm leading-snug font-semibold break-words">{form.name.trim() || (artifactMode ? 'Nombre de la herramienta' : `Nombre ${app ? 'de la app' : 'del ebook'}`)}</p>
              <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">{form.shortDescription.trim() || form.description.trim() || 'La descripción corta aparece acá.'}</p>
              {Number.isInteger(previewPrice) && previewPrice > 0 && <p className="text-xs text-muted-foreground line-through">{formatMoney(previewPrice, form.referenceCurrency || business.currency)}</p>}
            </div>
          </div>
          <dl className="grid gap-2 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Estado</dt><dd className="font-medium">{form.status === 'active' ? 'Activo' : 'Archivado'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Entrega</dt><dd className="text-right font-medium">{artifactMode ? 'Enlace a la herramienta' : app ? 'Link a la app' : deliverableSummary(form.deliverables)}</dd></div>
          </dl>
          {!artifactMode && !app && form.deliverables.length > 0 && <ViewContentButton product={{ name: form.name.trim() || untitled, deliverables: form.deliverables }} variant="secondary" className="w-full" />}
        </div>
        {actions}
      </aside>
    </div>
  </form></UploadContext.Provider>;
}

import { useStoreWorkspace } from './StoreWorkspace.jsx';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';

const EMPTY = { name: '', description: '', coverUrl: '', status: 'active', deliverables: [{ title: '', url: '' }] };

export default function ProductFormPage() {
  const { productsPath } = useStoreWorkspace();
  const { productId } = useParams();
  const navigate = useNavigate();
  const existing = useQuery(api.products.get, productId ? { id: productId } : 'skip');
  const create = useMutation(api.products.create);
  const update = useMutation(api.products.update);
  const [form, setForm] = useState(productId ? null : EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing && !form) {
      const { name, description, coverUrl, status, deliverables } = existing;
      setForm({ name, description, coverUrl, status, deliverables });
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
      if (productId) await update({ id: productId, ...form });
      else await create(form);
      navigate(productsPath);
    } catch (failure) { setError(errorText(failure, 'No se pudo guardar el producto. Volvé a intentar.')); setBusy(false); }
  }

  return <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6" aria-busy={busy}>
    <div className="space-y-3">
      <Button asChild variant="ghost" className="-ml-3"><Link to={productsPath}><ArrowLeft aria-hidden="true" />Productos</Link></Button>
      <h1 className="text-3xl font-semibold tracking-tight">{productId ? 'Editar producto' : 'Nuevo producto'}</h1>
    </div>

    <Card>
      <CardHeader><CardTitle>Datos del recurso</CardTitle><CardDescription>Este recurso es compartido. Sus cambios se reflejan en las landings y los checkouts de todas las tiendas que lo usan.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <Field label="Nombre">{props => <Input {...props} value={form.name} onChange={event => set({ name: event.target.value })} maxLength={120} required disabled={busy} />}</Field>
        <Field label="Descripción">{props => <Textarea {...props} value={form.description} onChange={event => set({ description: event.target.value })} maxLength={2000} disabled={busy} />}</Field>
        <Field label="Portada" hint="Link a una imagen. Podés dejarlo vacío.">{props => <Input {...props} type="url" inputMode="url" placeholder="https://" value={form.coverUrl} onChange={event => set({ coverUrl: event.target.value })} disabled={busy} />}</Field>
        <Field label="Estado" hint="Un producto archivado deja de ofrecerse al armar tiendas nuevas; las tiendas que ya lo usan no cambian.">{props => <NativeSelect {...props} value={form.status} onChange={event => set({ status: event.target.value })} disabled={busy}>
          <option value="active">Activo</option><option value="archived">Archivado</option>
        </NativeSelect>}</Field>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Entregables</CardTitle><CardDescription>Links que ve el comprador después de pagar. No se muestran en la landing. Quien reciba un link puede compartirlo si el servicio de destino lo permite.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {form.deliverables.length === 0 && <p className="text-sm text-muted-foreground">Sin entregables. Agregá al menos uno para poder vender este producto.</p>}
        {form.deliverables.map((link, index) => <fieldset key={index} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <legend className="sr-only">Entregable {index + 1}</legend>
          <Field label="Título">{props => <Input {...props} value={link.title} onChange={event => setLink(index, { title: event.target.value })} maxLength={120} required disabled={busy} />}</Field>
          <Field label="Link">{props => <Input {...props} type="url" inputMode="url" placeholder="https://" value={link.url} onChange={event => setLink(index, { url: event.target.value })} required disabled={busy} />}</Field>
          <Button type="button" variant="outline" size="icon" disabled={busy} aria-label={`Quitar entregable ${index + 1}`} onClick={() => set({ deliverables: form.deliverables.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" /></Button>
        </fieldset>)}
        <Button type="button" variant="outline" disabled={busy || form.deliverables.length >= 30} onClick={() => set({ deliverables: [...form.deliverables, { title: '', url: '' }] })}><Plus aria-hidden="true" />Agregar entregable</Button>
      </CardContent>
    </Card>

    <ErrorAlert>{error}</ErrorAlert>
    <div className="flex flex-wrap gap-3">
      <Button type="submit" size="lg" disabled={busy}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Guardando…' : 'Guardar producto'}</Button>
      <Button asChild variant="outline" size="lg"><Link to={productsPath}>Cancelar</Link></Button>
    </div>
  </form>;
}

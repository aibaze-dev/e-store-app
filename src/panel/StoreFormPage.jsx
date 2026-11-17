import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, BookOpen, Check, Gift, LoaderCircle, Plus, Tag, Trash2 } from 'lucide-react';
import business from '@/config/businessData.json';
import { api } from '@/lib/api.js';
import { errorText, formatMoney, fromMinor, toMinor } from '@/lib/format.js';
import { DOWNSELL_DEFAULTS, discountedPrice } from '@/storefront/downsell.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';

import { useStoreWorkspace } from './StoreWorkspace.jsx';
import OfferSection from './OfferSection.jsx';

const EMPTY = {
  name: '', status: 'draft', currency: business.currency, mainProductId: '', price: '', compareAtPrice: '', bonusValues: {},
  bonuses: [], upsells: [], postEnabled: false, postProductId: '', postPrice: '', postDownPercent: '', metaPixelId: '',
  downEnabled: false, downPercent: '', downTexts: DOWNSELL_DEFAULTS,
};

const DOWNSELL_TEXTS = [
  { key: 'modalTitle', label: 'Título del modal', max: 80 },
  { key: 'modalSubtitle', label: 'Subtítulo del modal', max: 240, long: true },
  { key: 'acceptText', label: 'Texto del botón principal', max: 40 },
  { key: 'declineText', label: 'Texto del botón secundario', max: 40, hint: 'Botón para descartar el modal sin ver la oferta.' },
  { key: 'pageTitle', label: 'Título de la página de la oferta', max: 80 },
  { key: 'pageSubtitle', label: 'Subtítulo de la página de la oferta', max: 240, long: true },
];

// Whole percentage between 1 and 90, or NaN.
const percentOf = text => (/^\d{1,2}$/.test(String(text).trim()) && Number(text) >= 1 && Number(text) <= 90 ? Number(text) : NaN);

function fromStore(store) {
  return {
    name: store.name, status: store.status, currency: store.currency,
    mainProductId: store.offer.mainProductId, price: fromMinor(store.offer.price, store.currency),
    compareAtPrice: fromMinor(store.offer.compareAtPrice, store.currency),
    bonusValues: Object.fromEntries(store.offer.bonuses.map(bonus => [bonus.productId, fromMinor(bonus.referenceValue, store.currency)])),
    bonuses: store.offer.bonuses.map(bonus => bonus.productId),
    upsells: [...store.offer.upsells].sort((a, b) => a.displayOrder - b.displayOrder)
      .map(upsell => ({ productId: upsell.productId, price: fromMinor(upsell.price, store.currency) })),
    postEnabled: store.postPurchase.enabled, postProductId: store.postPurchase.productId ?? '',
    postPrice: fromMinor(store.postPurchase.price, store.currency), metaPixelId: store.tracking.metaPixelId,
    postDownPercent: store.postPurchase.downsellPercent ? String(store.postPurchase.downsellPercent) : '',
    downEnabled: Boolean(store.downsell?.enabled), downPercent: store.downsell?.percent ? String(store.downsell.percent) : '',
    downTexts: Object.fromEntries(DOWNSELL_TEXTS.map(({ key }) => [key, store.downsell?.[key] || DOWNSELL_DEFAULTS[key]])),
  };
}

// Returns the mutation arguments, or a message describing what is missing.
function toArgs(form) {
  const currency = form.currency.trim().toUpperCase();
  const amount = (text, label) => {
    const value = toMinor(text, currency);
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${label}: ingresá un importe mayor a cero.`);
    return value;
  };
  const percent = (text, label) => {
    const value = percentOf(text);
    if (Number.isNaN(value)) throw new Error(`${label}: ingresá un porcentaje entero entre 1 y 90.`);
    return value;
  };
  if (!form.mainProductId) throw new Error('Elegí el producto principal.');
  if (form.bonuses.some(id => !id) || form.upsells.some(upsell => !upsell.productId)) throw new Error('Elegí un producto en cada bono y extra, o quitá las filas vacías.');
  if (form.postEnabled && !form.postProductId) throw new Error('Elegí el producto de la oferta post-compra.');
  return {
    name: form.name, status: form.status, currency,
    offer: {
      mainProductId: form.mainProductId,
      price: amount(form.price, 'Precio principal'),
      compareAtPrice: form.compareAtPrice.trim() ? amount(form.compareAtPrice, 'Precio de referencia') : undefined,
      bonuses: form.bonuses.map(productId => ({ productId, referenceValue: form.bonusValues[productId]?.trim() ? amount(form.bonusValues[productId], 'Valor del bono') : undefined })),
      upsells: form.upsells.map((upsell, index) => ({ productId: upsell.productId, price: amount(upsell.price, `Precio del extra ${index + 1}`), displayOrder: index })),
    },
    postPurchase: {
      enabled: form.postEnabled,
      productId: form.postProductId || undefined,
      price: form.postEnabled ? amount(form.postPrice, 'Precio post-compra') : Math.max(0, toMinor(form.postPrice, currency) || 0),
      downsellPercent: form.postEnabled && form.postDownPercent.trim() ? percent(form.postDownPercent, 'Descuento del downsell post-compra') : undefined,
    },
    downsell: {
      enabled: form.downEnabled,
      percent: form.downEnabled ? percent(form.downPercent, 'Descuento del downsell') : percentOf(form.downPercent) || 0,
      ...form.downTexts,
    },
    tracking: { metaPixelId: form.metaPixelId.trim() },
  };
}

export default function StoreFormPage({ section }) {
  const { productsPath } = useStoreWorkspace();
  const titles = { settings: 'Configuración', offer: 'Productos y oferta', post: 'Oferta post-compra', downsell: 'Downsell' };
  const show = key => !section || section === key || (section === 'offer' && ['main', 'bonuses', 'upsells'].includes(key));
  const { storeId } = useParams();
  const navigate = useNavigate();
  const products = useQuery(api.products.list, {});
  const existing = useQuery(api.stores.get, storeId ? { id: storeId } : 'skip');
  const create = useMutation(api.stores.create);
  const update = useMutation(api.stores.update);
  const [form, setForm] = useState(storeId ? null : EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (existing && !form) setForm(fromStore(existing)); }, [existing, form]);

  if (storeId && existing === null) return <EmptyState title="Esta tienda ya no existe">
    <Button asChild variant="outline"><Link to="/panel/tiendas">Volver a tiendas</Link></Button>
  </EmptyState>;
  if (!form || products === undefined) return <PageSkeleton label="Cargando tienda" />;
  if (products.length === 0) return <EmptyState title="Primero cargá un producto">
    <p>Una tienda vende un ebook del catálogo. Creá el producto con sus entregables y después volvé a armar la tienda.</p>
    <Button asChild><Link to={`${productsPath}/nuevo`}><Plus aria-hidden="true" />Nuevo producto</Link></Button>
  </EmptyState>;

  const set = change => { setSaved(false); setForm(current => ({ ...current, ...change })); };
  const used = [form.mainProductId, ...form.bonuses, ...form.upsells.map(upsell => upsell.productId), form.postProductId];
  const options = products.filter(product => product.status === 'active' || used.includes(product._id));
  const productSelect = (props, value, onChange) => <NativeSelect {...props} value={value} onChange={event => onChange(event.target.value)} disabled={busy}>
    <option value="">Elegí un producto</option>
    {options.map(product => <option key={product._id} value={product._id}>{product.name}{product.status === 'archived' ? ' (archivado)' : ''}</option>)}
  </NativeSelect>;
  const priceInput = (props, value, onChange) => <Input {...props} inputMode="decimal" placeholder="0.00" value={value} onChange={event => onChange(event.target.value)} disabled={busy} />;

  // Preview of a discounted price; the server calculates the charged one with the same rule.
  const discountHint = (priceText, percentText) => {
    const price = toMinor(priceText, form.currency);
    const value = percentOf(percentText);
    return price > 0 && value ? `Precio con descuento: ${formatMoney(discountedPrice(price, value), form.currency)}.` : '';
  };
  const percentInput = (props, value, onChange) => <Input {...props} inputMode="numeric" placeholder="25" maxLength={2} value={value} onChange={event => onChange(event.target.value)} disabled={busy} />;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setSaved(false);
    let args;
    try {
      const productReference = products.find(product => product._id === form.mainProductId)?.referencePrice;
      args = toArgs(productReference !== undefined ? { ...form, compareAtPrice: '' } : form);
    } catch (invalid) {
      event.currentTarget.querySelectorAll('details').forEach(details => { details.open = true; });
      setError(invalid.message);
      return;
    }
    setBusy(true);
    try {
      if (storeId) { await update({ id: storeId, ...args }); setSaved(true); }
      else navigate(`/panel/tiendas/${await create(args)}/landing`);
    } catch (failure) { setError(errorText(failure, 'No se pudo guardar la tienda. Volvé a intentar.')); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6" aria-busy={busy}>
    <div className="space-y-3">
      <Button asChild variant="ghost" className="-ml-3"><Link to={storeId ? `/panel/tiendas/${storeId}` : "/panel/tiendas"}><ArrowLeft aria-hidden="true" />{storeId ? "Inicio de la tienda" : "Tiendas"}</Link></Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{storeId ? titles[section] || 'Configurar tienda' : 'Nueva tienda'}</h1>
        {storeId && <Button asChild variant="outline"><Link to={`/panel/tiendas/${storeId}/landing`}>Editar landing</Link></Button>}
      </div>
      {section === 'offer' && <p className="text-sm leading-6 text-muted-foreground">Configurá el producto principal, los bonus incluidos y los upsells de esta tienda. Desplegá cada sección y guardá todo junto.</p>}
    </div>

    {show('settings') && <Card>
      <CardHeader><CardTitle>Campaña</CardTitle><CardDescription>Solo las tiendas activas con landing publicada reciben visitas y ventas.</CardDescription></CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2">{props => <Input {...props} value={form.name} onChange={event => set({ name: event.target.value })} maxLength={120} required disabled={busy} />}</Field>
        <Field label="Estado">{props => <NativeSelect {...props} value={form.status} onChange={event => set({ status: event.target.value })} disabled={busy}>
          <option value="draft">Borrador</option><option value="active">Activa</option>
        </NativeSelect>}</Field>
        <Field label="Moneda" hint="Código de tres letras. Los precios de esta tienda se cobran en esta moneda.">{props => <Input {...props} value={form.currency} onChange={event => set({ currency: event.target.value })} maxLength={3} required autoCapitalize="characters" disabled={busy} />}</Field>
      </CardContent>
    </Card>}

    {show('main') && <OfferSection id="principal" title="Producto principal" icon={BookOpen} defaultOpen summary={products.find(product => product._id === form.mainProductId)?.name || 'Elegí el ebook que vende esta campaña'}>
      <CardContent className="grid gap-5 sm:grid-cols-[1.6fr_1fr]">
        <Field label="Producto principal">{props => productSelect(props, form.mainProductId, mainProductId => set({ mainProductId }))}</Field>
        <Field label="Precio">{props => priceInput(props, form.price, price => set({ price }))}</Field>
        {form.mainProductId && <p className="text-sm leading-6 text-muted-foreground sm:col-span-2">La portada, descripción corta y precio de referencia se configuran en el producto. <Link to={`${productsPath}/${form.mainProductId}`} className="underline underline-offset-4">Editar presentación del producto</Link></p>}
        {form.compareAtPrice && products.find(product => product._id === form.mainProductId)?.referencePrice === undefined && <Field label="Precio de referencia anterior" hint="Se conserva por compatibilidad. Configurá el precio en el producto para unificarlo en todas las tiendas.">{props => priceInput(props, form.compareAtPrice, compareAtPrice => set({ compareAtPrice }))}</Field>}
      </CardContent>
    </OfferSection>}

    {show('bonuses') && <OfferSection id="bonos" title="Bonus gratis" icon={Gift} summary={form.bonuses.length ? `${form.bonuses.length} ${form.bonuses.length === 1 ? 'bonus incluido' : 'bonus incluidos'} en la compra` : 'Sin bonus incluidos'}>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">Recursos de regalo incluidos en la compra. El valor de referencia es informativo y nunca se cobra.</p>
        {form.bonuses.length === 0 && <p className="text-sm text-muted-foreground">Esta tienda no incluye bonos.</p>}
        {form.bonuses.map((productId, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label={`Bono ${index + 1}`}>{props => productSelect(props, productId, value => set({ bonuses: form.bonuses.map((id, i) => (i === index ? value : id)) }))}</Field>
          <Field label="Valor de referencia (opcional)">{props => priceInput(props, form.bonusValues[productId] || '', value => set({ bonusValues: { ...form.bonusValues, [productId]: value } }))}</Field>
          <Button type="button" variant="outline" size="icon" disabled={busy} aria-label={`Quitar bono ${index + 1}`} onClick={() => set({ bonuses: form.bonuses.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" /></Button>
        </div>)}
        <Button type="button" variant="outline" disabled={busy || form.bonuses.length >= 20} onClick={() => set({ bonuses: [...form.bonuses, ''] })}><Plus aria-hidden="true" />Agregar bono</Button>
      </CardContent>
    </OfferSection>}

    {show('upsells') && <OfferSection id="upsells" title="Upsells y precios" icon={Tag} summary={form.upsells.length ? `${form.upsells.length} ${form.upsells.length === 1 ? 'extra opcional' : 'extras opcionales'} en el checkout` : 'Sin extras opcionales'}>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">Opcionales con precio propio. El comprador los marca en el checkout y se suman al mismo cobro, en este orden.</p>
        {form.upsells.length === 0 && <p className="text-sm text-muted-foreground">Esta tienda no ofrece extras.</p>}
        {form.upsells.map((upsell, index) => {
          const change = patch => set({ upsells: form.upsells.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
          return <fieldset key={index} className="grid gap-3 sm:grid-cols-[1.6fr_1fr_auto] sm:items-end">
            <legend className="sr-only">Extra {index + 1}</legend>
            <Field label={`Extra ${index + 1}`}>{props => productSelect(props, upsell.productId, productId => change({ productId }))}</Field>
            <Field label="Precio">{props => priceInput(props, upsell.price, price => change({ price }))}</Field>
            <Button type="button" variant="outline" size="icon" disabled={busy} aria-label={`Quitar extra ${index + 1}`} onClick={() => set({ upsells: form.upsells.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" /></Button>
          </fieldset>;
        })}
        <Button type="button" variant="outline" disabled={busy || form.upsells.length >= 10} onClick={() => set({ upsells: [...form.upsells, { productId: '', price: '' }] })}><Plus aria-hidden="true" />Agregar extra</Button>
      </CardContent>
    </OfferSection>}

    {show('post') && <Card>
      <CardHeader><CardTitle>Oferta post-compra</CardTitle><CardDescription>Se ofrece después del primer pago y se cobra con un segundo checkout. Si el comprador la rechaza, sigue a sus links.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {storeId && <p className="text-sm leading-6 text-muted-foreground">Los textos, beneficios y video VSL se configuran en <Link to={`/panel/tiendas/${storeId}/landing#postPurchase`} target="_blank" rel="noreferrer" className="underline">las secciones de post-compra del editor de landing</Link>. Guardá aquí el producto y el precio antes de generar sus textos con IA.</p>}
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="size-5 accent-primary" checked={form.postEnabled} onChange={event => set({ postEnabled: event.target.checked })} disabled={busy} />
          Ofrecer un producto después de la compra
        </label>
        {form.postEnabled && <div className="grid gap-5 sm:grid-cols-[1.6fr_1fr]">
          <Field label="Producto">{props => productSelect(props, form.postProductId, postProductId => set({ postProductId }))}</Field>
          <Field label="Precio">{props => priceInput(props, form.postPrice, postPrice => set({ postPrice }))}</Field>
          <Field label="Downsell: descuento % (opcional)" className="sm:col-span-2" hint={`Si el comprador responde «No, gracias», se le ofrece una vez el mismo producto con este descuento. Vacío: sin downsell. ${discountHint(form.postPrice, form.postDownPercent)}`}>{props => percentInput(props, form.postDownPercent, postDownPercent => set({ postDownPercent }))}</Field>
        </div>}
      </CardContent>
    </Card>}

    {show('downsell') && <Card>
      <CardHeader><CardTitle>Downsell del producto principal</CardTitle><CardDescription>Cuando el visitante intenta volver atrás para abandonar la landing o el checkout, se abre un cartel con un regalo. Si acepta, ve el producto principal con sus bonos, sin extras, al precio con descuento. Se muestra una vez por pestaña.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="size-5 accent-primary" checked={form.downEnabled} onChange={event => set({ downEnabled: event.target.checked })} disabled={busy} />
          Ofrecer un descuento al intentar salir
        </label>
        {form.downEnabled && <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Descuento %" className="sm:col-span-2" hint={`Entero entre 1 y 90, sobre el precio del producto principal. ${discountHint(form.price, form.downPercent)}`}>{props => percentInput(props, form.downPercent, downPercent => set({ downPercent }))}</Field>
          {DOWNSELL_TEXTS.map(({ key, label, max, long, hint }) => {
            const Control = long ? Textarea : Input;
            return <Field key={key} label={label} hint={hint} className={long ? 'sm:col-span-2' : ''}>{props => <Control {...props} value={form.downTexts[key]} onChange={event => set({ downTexts: { ...form.downTexts, [key]: event.target.value } })} maxLength={max} disabled={busy} />}</Field>;
          })}
        </div>}
      </CardContent>
    </Card>}

    {show('settings') && <Card>
      <CardHeader><CardTitle>Seguimiento</CardTitle><CardDescription>Con un ID de Meta Pixel se envían los eventos PageView, InitiateCheckout y Purchase desde el navegador del visitante.</CardDescription></CardHeader>
      <CardContent>
        <Field label="ID de Meta Pixel" hint="Solo el número. Dejalo vacío para no usar pixel.">{props => <Input {...props} inputMode="numeric" value={form.metaPixelId} onChange={event => set({ metaPixelId: event.target.value })} maxLength={20} disabled={busy} />}</Field>
      </CardContent>
    </Card>}

    <ErrorAlert>{error}</ErrorAlert>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="lg" disabled={busy}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Guardando…' : storeId ? 'Guardar cambios' : 'Crear tienda y armar landing'}</Button>
      <p className="text-sm text-muted-foreground" role="status">{saved && <span className="inline-flex items-center gap-2"><Check className="size-4" aria-hidden="true" />Cambios guardados.</span>}</p>
    </div>
  </form>;
}

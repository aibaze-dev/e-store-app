import { CLASSIC_ACCENT, classicAccent } from '../../shared/classic-design.js';
import { discountedPrice } from '@/storefront/downsell.js';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, ChevronDown, Eye, LoaderCircle, Monitor, Plus, Smartphone, Trash2 } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText, formatDate } from '@/lib/format.js';
import { landingUrls } from '@/lib/site.js';
import { normalizeContent, mergeGeneratedContent } from '@/templates/content.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';
import StoreOfferSummary from './StoreOfferSummary.jsx';
import LandingFrame from './LandingFrame.jsx';
import LandingWizard from './LandingWizard.jsx';

const ICONS = { check: 'Check', book: 'Libro', target: 'Objetivo', growth: 'Progreso', strength: 'Fuerza', brain: 'Aprendizaje', settings: 'Herramientas', cart: 'Compra', mail: 'Entrega', sparkles: 'Resultado' };
const newFeature = () => ({ title: '', description: '', icon: 'check' });
const slug = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/, '');
const localDate = timestamp => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function Section({ id, number, title, description, children, defaultOpen = false }) {
  return <details id={id} className="landing-form-section" open={defaultOpen || undefined}>
    <summary><span className="landing-section-number">{number}</span><span><strong>{title}</strong><small>{description}</small></span><ChevronDown aria-hidden="true" /></summary>
    <div className="landing-section-fields">{children}</div>
  </details>;
}

export default function LandingEditPage() {
  const { storeId } = useParams();
  const { hash } = useLocation();
  const landing = useQuery(api.landings.getForStore, { storeId });
  const store = useQuery(api.stores.get, { id: storeId });
  const products = useQuery(api.products.list, {});
  const saveDraft = useMutation(api.landings.saveDraft);
  const publish = useMutation(api.landings.publish);
  if (landing === undefined || !store || !products) return <PageSkeleton label="Cargando landing" />;
  async function save(form, action) {
    await saveDraft({ storeId, subdomain: form.subdomain, template: 'classic', draft: form.content });
    if (action === 'publish') await publish({ storeId });
  }
  return <LandingConfigurator key={storeId} landing={landing} store={store} products={products} hash={hash} onSave={save} />;
}

export function LandingConfigurator({ landing, store, products, hash = '', onSave }) {
  const [form, setForm] = useState(() => ({ subdomain: landing?.subdomain ?? '', content: normalizeContent(landing?.draft) }));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('mobile');
  const [previewTarget, setPreviewTarget] = useState(hash.startsWith('#postPurchase') ? 'post' : 'landing');
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(() => JSON.stringify(form));
  const errorRef = useRef(null);
  const content = form.content;
  const storeId = store._id;
  const dirty = JSON.stringify(form) !== saved;
  const pending = landing?.published && JSON.stringify(landing.published) !== JSON.stringify(landing.draft);
  useEffect(() => {
    if (!hash) return;
    if (hash.startsWith('#postPurchase')) setPreviewTarget('post');
    const element = document.getElementById(hash.slice(1));
    if (element instanceof HTMLDetailsElement) element.open = true;
    element?.scrollIntoView({ block: 'start' });
  }, [hash]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const change = (key, patch) => { setNotice(''); setForm(current => ({ ...current, content: { ...current.content, [key]: { ...current.content[key], ...patch } } })); };
  const field = (key, property, label, { multiline = false, hint, ...props } = {}) => <Field label={label} hint={hint}>{ids => {
    const Control = multiline ? Textarea : Input;
    return <Control {...ids} value={content[key][property] ?? ''} onChange={event => change(key, { [property]: event.target.value, ...(key === 'postPurchaseVideo' && property === 'url' && !event.target.value.trim() ? { enabled: false } : {}) })} disabled={Boolean(busy)} {...props} />;
  }}</Field>;
  const numberField = (key, property, label, max, step = 1) => <Field label={label}>{ids => <Input {...ids} type="number" min="0" max={max} step={step} value={content[key][property] ?? ''} onChange={event => change(key, { [property]: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={Boolean(busy)} />}</Field>;
  const toggle = (key, label = 'Mostrar esta sección', property = 'enabled') => <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-5 accent-primary" checked={content[key][property]} onChange={event => change(key, { [property]: event.target.checked })} disabled={Boolean(busy)} />{label}</label>;
  const sectionHeading = key => <>{toggle(key)}{field(key, 'title', 'Título de la sección', { maxLength: 120 })}{field(key, 'subtitle', 'Subtítulo (opcional)', { maxLength: 400 })}</>;
  // Builds the landing from the assistant's texts and saves it as a draft right away.
  // Fields the assistant does not write keep their value; publishing stays a separate step.
  const applyGenerated = async generated => {
    const next = {
      subdomain: form.subdomain || slug(store.name),
      content: mergeGeneratedContent(content, generated),
    };
    setError(''); setNotice(''); setForm(next); setShowPreview(true);
    try {
      await onSave(next, 'save');
      setSaved(JSON.stringify(next));
      setNotice('Landing generada y guardada como borrador. Revisala y publicala.');
    } catch (failure) { setError(`La landing se generó, pero no se pudo guardar. ${errorText(failure, 'Revisá el formulario y guardá el borrador.')}`); }
  };
  const changeItem = (key, index, patch) => change(key, { items: content[key].items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const itemField = (key, index, property, label, { multiline = false, ...props } = {}) => <Field label={label}>{ids => {
    const Control = multiline ? Textarea : Input;
    return <Control {...ids} value={content[key].items[index][property] || ''} onChange={event => changeItem(key, index, { [property]: event.target.value })} disabled={Boolean(busy)} {...props} />;
  }}</Field>;
  const remove = (key, index, label) => <Button type="button" variant="ghost" className="text-destructive" disabled={Boolean(busy)} onClick={() => change(key, { items: content[key].items.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" />Quitar {label} {index + 1}</Button>;
  const add = (key, label, item, max) => <Button type="button" variant="outline" disabled={Boolean(busy) || content[key].items.length >= max} onClick={() => change(key, { items: [...content[key].items, item] })}><Plus aria-hidden="true" />Agregar {label}</Button>;
  const features = (key, label, max = 12) => <>{sectionHeading(key)}{content[key].items.length === 0 && <p className="text-sm text-muted-foreground">Agregá {label} para mostrar esta sección.</p>}{content[key].items.map((item, index) => <fieldset key={index} className="landing-item-fields"><legend>{label} {index + 1}</legend>
    {itemField(key, index, 'title', 'Título', { maxLength: 240, required: true })}
    {itemField(key, index, 'description', 'Descripción', { multiline: true, maxLength: 600 })}
    {key !== 'painPoints' && <Field label="Ícono">{ids => <NativeSelect {...ids} value={item.icon} onChange={event => changeItem(key, index, { icon: event.target.value })} disabled={Boolean(busy)}>{Object.entries(ICONS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</NativeSelect>}</Field>}
    {remove(key, index, label)}
  </fieldset>)}{add(key, label, newFeature(), max)}</>;

  const storyFields = (key, { image = false, text = false } = {}) => <>
    {sectionHeading(key)}
    {field(key, 'eyebrow', 'Antetítulo (opcional)', { maxLength: 120 })}
    {text && field(key, 'text', 'Texto de la sección', { multiline: true, maxLength: 2400, hint: 'Separá los párrafos con un salto de línea.' })}
    {image && <>{field(key, 'imageUrl', 'Imagen de la sección (URL)', { type: 'url', placeholder: 'https://' })}{field(key, 'imageAlt', 'Descripción de la imagen', { maxLength: 240, hint: 'Describí la imagen para quienes usan un lector de pantalla.' })}</>}
  </>;

  const mainProduct = products.find(product => product._id === store.offer.mainProductId);
  const postProduct = products.find(product => product._id === store.postPurchase.productId);
  const preview = mainProduct ? {
    postPurchaseOffer: store.postPurchase.enabled && postProduct ? { ...postProduct, price: store.postPurchase.price,
      ...(store.postPurchase.downsellPercent ? { downsellPercent: store.postPurchase.downsellPercent, downsellPrice: discountedPrice(store.postPurchase.price, store.postPurchase.downsellPercent) } : {}),
    } : null,
    content, store: { name: store.name, currency: store.currency },
    offer: {
      main: { ...mainProduct, price: store.offer.price, compareAtPrice: store.offer.compareAtPrice },
      bonuses: store.offer.bonuses.flatMap(bonus => {
        const product = products.find(item => item._id === bonus.productId);
        return product ? [{ ...product, productId: bonus.productId, referenceValue: bonus.referenceValue }] : [];
      }),
    },
  } : null;
  const urls = landing?.subdomain ? landingUrls(landing.subdomain) : null;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const action = event.nativeEvent.submitter?.value || 'save';
    setBusy(action); setError(''); setNotice('');
    try {
      await onSave(form, action);
      setSaved(JSON.stringify(form));
      setNotice(action === 'publish' ? 'Landing publicada.' : 'Borrador guardado.');
    } catch (failure) { setError(errorText(failure, 'No se pudo guardar la landing. Volvé a intentar.')); }
    finally { setBusy(''); }
  }

  return <div className="landing-configurator">
    <div className="mb-6 space-y-3">
      <Button asChild variant="ghost" className="-ml-3"><Link to={`/panel/tiendas/${storeId}`}><ArrowLeft aria-hidden="true" />Inicio de la tienda</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-semibold uppercase tracking-widest text-primary">Landing clásica · diseño editorial</span><h1 className="mt-2 text-3xl font-semibold tracking-tight">Configurá tu landing</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Armá el recorrido de tu landing: presentación, transformación, bonos y oferta. Los bloques opcionales aparecen cuando los activás y completás.</p></div><Button type="button" variant="outline" onClick={() => setShowPreview(value => !value)}><Eye aria-hidden="true" />{showPreview ? 'Volver al formulario' : 'Ampliar vista previa'}</Button></div>
      <p className="text-xs leading-6 text-muted-foreground">{landing?.publishedAt ? `Publicada el ${formatDate(landing.publishedAt)}.` : 'Todavía sin publicar.'} {dirty ? 'Tenés cambios sin guardar.' : pending ? 'Hay un borrador pendiente de publicar.' : ''}</p>
    </div>
    <div className="classic-design-note"><div><span aria-hidden="true" className="classic-palette"><i /><i /><i /></span><strong>Naranja, crema y chocolate</strong><p>Imágenes protagonistas, contenido centrado y ofertas destacadas. Conservá tus promociones y activá los nuevos bloques a medida que los completes.</p></div><Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => change('style', { accentColor: CLASSIC_ACCENT })}>Usar paleta de referencia</Button></div>
    <LandingWizard storeId={storeId} hasContent={Boolean(content.hero.title)} disabled={Boolean(busy)} onApply={applyGenerated} />
    <div className={`landing-config-grid ${showPreview ? 'preview-expanded' : ''}`}>
      <form onSubmit={submit} onInvalidCapture={event => { const section = event.target.closest('details'); if (section) section.open = true; }} className="landing-config-form" aria-busy={Boolean(busy)}>
        <Section id="hero" number="01" title="Presentación principal" description="La promesa, portada y botón de tu ebook" defaultOpen>
          {field('hero', 'eyebrow', 'Antetítulo (opcional)', { maxLength: 120, placeholder: 'Tu próximo paso empieza acá' })}
          {field('hero', 'title', 'Título principal', { maxLength: 160, placeholder: 'Pasá de intentarlo a lograrlo con un plan claro' })}
          {field('hero', 'subtitle', 'Subtítulo', { multiline: true, maxLength: 400 })}
          {field('hero', 'imageUrl', 'Imagen principal (URL)', { type: 'url', hint: 'Si lo dejás vacío, usamos la portada del producto.', placeholder: 'https://' })}
          {field('hero', 'secondaryImageUrl', 'Segunda imagen de portada (URL)', { type: 'url', hint: 'Se muestra al lado de la principal: usala para mostrar el contenido del kit.', placeholder: 'https://' })}
          {field('hero', 'note', 'Nota debajo del botón', { multiline: true, maxLength: 240, hint: 'Una aclaración breve sobre el formato, el acceso o los requisitos.' })}
          {field('hero', 'ctaText', 'Texto del botón de compra', { maxLength: 60 })}
        </Section>
        <Section id="introduction" number="02" title="Introducción" description="Una explicación breve después de la portada">{storyFields('introduction', { text: true })}</Section>
        <Section id="transformation" number="03" title="Antes y después" description="Mostrá el cambio con una imagen protagonista">{storyFields('transformation', { image: true })}</Section>
        <Section id="painPoints" number="04" title="¿Te sentís identificado?" description="Los problemas que resuelve tu ebook">{features('painPoints', 'problema')}{field('painPoints', 'closingText', 'Frase de cierre', { maxLength: 240 })}</Section>
        <Section id="offer" number="05" title="Oferta y bonos" description="El producto y los importes de esta tienda">
          <StoreOfferSummary store={store} products={products} openInNewTab />
          <p className="text-xs leading-6 text-muted-foreground">Configurá el precio tachado y los valores de referencia de los bonus en Productos y oferta. Se reutilizan en toda la landing. Estos enlaces abren otra pestaña para que conserves lo que estás escribiendo.</p>
          {sectionHeading('bonuses')}
        </Section>
        <Section id="steps" number="06" title="Cómo se aplica" description="Explicá el recorrido en pasos simples">{features('steps', 'paso', 7)}</Section>
        <Section id="about" number="07" title="Quiénes somos" description="La historia y el equipo detrás de tu producto">{storyFields('about', { image: true, text: true })}{field('about', 'signature', 'Firma o nombre del equipo', { maxLength: 120 })}</Section>
        <Section id="showcase" number="08" title="Imagen del kit completo" description="Una vista de todo lo que recibe el comprador">{storyFields('showcase', { image: true })}</Section>
        <Section id="benefits" number="09" title="Qué vas a encontrar" description="Beneficios con ícono, título y descripción">{features('benefits', 'beneficio')}</Section>
        <Section id="summary" number="10" title="Resumen de la compra" description="Producto, bonos, precio y ahorro en un solo lugar">{sectionHeading('summary')}<p className="text-xs leading-6 text-muted-foreground">El contenido se completa con la oferta y la garantía de esta tienda.</p></Section>
        <Section id="socialProof" number="11" title="Prueba social · Testimonios" description="Opiniones en tarjetas, conversaciones o capturas">
          {sectionHeading('socialProof')}
          {field('socialProof', 'eyebrow', 'Texto superior (opcional)', { maxLength: 120, placeholder: 'Testimonios reales' })}
          {content.socialProof.items.length === 0 && <p className="text-sm text-muted-foreground">Agregá un testimonio para mostrar esta sección en la landing. Podés usar una captura de la conversación.</p>}
          <p className="text-xs text-muted-foreground">Métricas opcionales: completalas con tus datos. Si quedan vacías, no se muestran.</p>
          {numberField('socialProof', 'rating', 'Calificación (0 a 5)', 5, 0.1)}
          {numberField('socialProof', 'customers', 'Cantidad de clientes', 100000000)}
          {numberField('socialProof', 'satisfaction', 'Satisfacción (%)', 100)}
          {content.socialProof.items.map((item, index) => <fieldset key={index} className="landing-item-fields"><legend>Testimonio {index + 1}</legend>
            {itemField('socialProof', index, 'name', 'Nombre', { maxLength: 120, required: true })}
            <Field label="Presentación">{ids => <NativeSelect {...ids} value={item.format} onChange={event => changeItem('socialProof', index, { format: event.target.value })} disabled={Boolean(busy)}><option value="quote">Texto o captura</option><option value="chat">Conversación estilo WhatsApp</option></NativeSelect>}</Field>
            {item.format === 'chat' && itemField('socialProof', index, 'openingMessage', 'Tu mensaje inicial (opcional)', { multiline: true, maxLength: 1200 })}
            {itemField('socialProof', index, 'quote', item.format === 'chat' ? 'Mensaje del lector' : 'Testimonio', { multiline: true, maxLength: 1200, required: item.format === 'chat' })}
            {item.format === 'chat' && itemField('socialProof', index, 'closingMessage', 'Tu respuesta de cierre (opcional)', { multiline: true, maxLength: 1200 })}
            {item.format !== 'chat' && itemField('socialProof', index, 'imageUrl', 'Captura (URL, opcional)', { type: 'url', placeholder: 'https://' })}
            {remove('socialProof', index, 'testimonio')}
          </fieldset>)}
          <p className="text-xs text-muted-foreground">Todos los testimonios muestran cinco estrellas. Podés editar los textos y agregar conversaciones o capturas; los testimonios cargados a mano se conservan al volver a generar.</p>
          {add('socialProof', 'testimonio', { name: '', quote: '', imageUrl: '', format: 'chat', openingMessage: '', closingMessage: '' }, 12)}
        </Section>
        <Section id="comparison" number="12" title="Comparación de alternativas" description="Hasta tres caminos, con una opción destacada">
          {sectionHeading('comparison')}{field('comparison', 'eyebrow', 'Antetítulo (opcional)', { maxLength: 120 })}
          {content.comparison.items.map((item, index) => <fieldset key={index} className="landing-item-fields"><legend>Opción {index + 1}</legend>
            {itemField('comparison', index, 'title', 'Nombre de la opción', { maxLength: 120, required: true })}
            {itemField('comparison', index, 'description', 'Qué ofrece esta opción', { multiline: true, maxLength: 600, required: true })}
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={item.highlighted} disabled={Boolean(busy)} onChange={event => change('comparison', { items: content.comparison.items.map((entry, i) => ({ ...entry, highlighted: i === index ? event.target.checked : false })) })} />Destacar esta opción con el botón de compra</label>
            {remove('comparison', index, 'opción')}
          </fieldset>)}
          {add('comparison', 'opción', { title: '', description: '', highlighted: false }, 3)}
        </Section>
        <Section id="guarantee" number="13" title="Garantía" description="Las condiciones que ofrecés al comprador">
          {toggle('guarantee')}
          <Field label="Días de garantía (opcional)">{ids => <Input {...ids} type="number" min="1" max="365" step="1" value={content.guarantee.days ?? ''} onChange={event => change('guarantee', { days: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={Boolean(busy)} />}</Field>
          {field('guarantee', 'title', 'Título', { maxLength: 120 })}{field('guarantee', 'text', 'Condiciones de la garantía', { multiline: true, maxLength: 1200, hint: 'La garantía aparece cuando completás este texto. Los días se repiten automáticamente junto a los botones.' })}
        </Section>
        <Section id="faq" number="14" title="Preguntas frecuentes" description="Respondé las dudas antes de la compra">
          {sectionHeading('faq')}
          {content.faq.items.map((item, index) => <fieldset key={index} className="landing-item-fields"><legend>Pregunta {index + 1}</legend>{itemField('faq', index, 'question', 'Pregunta', { maxLength: 240, required: true })}{itemField('faq', index, 'answer', 'Respuesta', { multiline: true, maxLength: 1200, required: true })}{remove('faq', index, 'pregunta')}</fieldset>)}
          {add('faq', 'pregunta', { question: '', answer: '' }, 20)}
        </Section>
        <Section id="closing" number="15" title="Cierre y botón fijo" description="La última invitación a comprar">
          {toggle('closing')}{field('closing', 'title', 'Título final', { maxLength: 160, hint: 'Si queda vacío, usamos el título principal.' })}{field('closing', 'ctaText', 'Texto del botón final', { maxLength: 60 })}{toggle('closing', 'Mostrar el botón fijo al pie de la pantalla', 'stickyEnabled')}
        </Section>
        <Section id="promotion" number="16" title="Promoción y actividad" description="Contador compartido, cupos y actividad">
          {toggle('promotion', 'Mostrar promoción')}{field('promotion', 'message', 'Mensaje', { maxLength: 120 })}
          <Field label="Tipo de contador">{ids => <NativeSelect {...ids} value={content.promotion.timerMode} onChange={event => change('promotion', { timerMode: event.target.value })} disabled={Boolean(busy)}><option value="session">Por visita · entre 8 y 15 minutos</option><option value="date">Fecha de vencimiento</option></NativeSelect>}</Field>
          <p className="text-xs text-muted-foreground">El contador por visita es simulado, se comparte con el checkout y no reinicia al navegar o recargar. No modifica precios ni bloquea pagos.</p>
          {content.promotion.timerMode === 'date' && <Field label="Vencimiento" hint="Hora local de tu dispositivo. Al vencer se ocultan la barra y el contador. El precio se administra en la oferta de la tienda.">{ids => <Input {...ids} type="datetime-local" value={localDate(content.promotion.endsAt)} onChange={event => change('promotion', { endsAt: event.target.value ? new Date(event.target.value).getTime() : undefined })} disabled={Boolean(busy)} required />}</Field>}
          {field('promotion', 'timerLabel', 'Texto del contador', { maxLength: 120, hint: 'Aparece junto al tiempo en la landing, el botón fijo y el checkout.' })}
          {field('promotion', 'spotsText', 'Texto de cupos', { maxLength: 240, hint: 'Usá {cantidad} para insertar los cupos disponibles.' })}
          {numberField('promotion', 'remainingSpots', 'Cupos disponibles (opcional)', 1000000)}
          {toggle('activity', 'Mostrar personas viendo (simulado)', 'viewers')}
          {field('activity', 'viewersText', 'Texto de personas viendo', { maxLength: 240, hint: 'Usá {cantidad} para insertar el número de personas.' })}
          {toggle('activity', 'Mostrar avisos de compra simulados (demo)', 'notifications')}
          {field('activity', 'purchaseText', 'Texto del aviso de compra', { maxLength: 240, hint: 'Usá {nombre} para insertar el nombre. Se comparte con los avisos del checkout.' })}
          {field('activity', 'purchaseLocationText', 'Texto de ubicación del aviso', { maxLength: 240, hint: 'Usá {ciudad} para insertar la ubicación.' })}
          {toggle('activity', 'Mostrar la cantidad de ventas', 'salesCount')}
          {field('activity', 'salesText', 'Texto de ventas confirmadas', { maxLength: 240, hint: 'Usá {cantidad} para insertar la cantidad de ventas reales.' })}
          <p className="text-xs leading-6 text-muted-foreground">Activá los elementos que querés mostrar y revisalos en la vista previa. Guardar borrador conserva tus cambios sin publicarlos; Guardar y publicar los aplica a la landing pública. No requieren una aprobación adicional.</p>
          <p className="text-xs leading-6 text-muted-foreground">Los avisos usan nombres y ciudades ficticios con pausas aleatorias y la etiqueta visible. Aparecen también en la vista previa, sin necesitar ventas. El contador de ventas sigue mostrando únicamente pagos confirmados.</p>
        </Section>
        <Section id="identity" number="17" title="Identidad y dirección" description="Color, marca, enlaces y dirección pública">
          <Field label="Color principal" hint="Usá la paleta de referencia o elegí otro acento. Los botones ajustan su contraste automáticamente.">{ids => <div className="flex items-center gap-3"><input {...ids} type="color" className="h-11 w-14 cursor-pointer rounded border" value={classicAccent(content.style.accentColor)} onChange={event => change('style', { accentColor: event.target.value })} disabled={Boolean(busy)} /><span className="text-sm text-muted-foreground">{classicAccent(content.style.accentColor)}</span></div>}</Field>
          {field('footer', 'brandName', 'Marca en el pie de página', { maxLength: 120, hint: 'Si queda vacío, usamos el nombre de la tienda.' })}
          {field('footer', 'termsUrl', 'Términos y condiciones (URL)', { type: 'url' })}{field('footer', 'privacyUrl', 'Política de privacidad (URL)', { type: 'url' })}
          <Field label="Subdominio" hint="Minúsculas, números y guiones. Guardar un cambio de dirección lo aplica de inmediato.">{ids => <Input {...ids} value={form.subdomain} onChange={event => setForm(current => ({ ...current, subdomain: event.target.value }))} required maxLength={63} autoCapitalize="none" spellCheck={false} disabled={Boolean(busy)} />}</Field>
          {urls && <p className="text-xs leading-6 text-muted-foreground">Dirección pública: <a href={urls.path} target="_blank" rel="noreferrer" className="break-all underline">{urls.path}</a><br />El subdominio propio requiere configurar dominio y DNS.</p>}
        </Section>
        <Section id="postPurchase" number="18" title="Post-compra · Presentación" description="La oferta que se muestra después del pago">
          <p className="text-sm leading-6 text-muted-foreground">{store.postPurchase.enabled && postProduct ? `Producto: ${postProduct.name}. El precio se toma de la oferta de esta tienda.` : 'La oferta post-compra está desactivada o no tiene un producto. Podés preparar los textos y activarla desde su configuración.'}</p>
          <Link to={`/panel/tiendas/${storeId}/post-compra`} target="_blank" rel="noreferrer" className="text-sm underline">Configurar producto, precio y activación</Link>
          <Button type="button" variant="outline" onClick={() => { setPreviewTarget('post'); setShowPreview(true); }}><Eye aria-hidden="true" />Ver post-compra</Button>
          {field('postPurchase', 'eyebrow', 'Texto superior', { maxLength: 120 })}
          {field('postPurchase', 'title', 'Título de la oferta post-compra', { maxLength: 160, hint: 'Si queda vacío, usamos el nombre del producto post-compra.' })}
          {field('postPurchase', 'subtitle', 'Subtítulo de la oferta post-compra', { multiline: true, maxLength: 400 })}
          {field('postPurchase', 'description', 'Descripción de la oferta post-compra', { multiline: true, maxLength: 1200, hint: 'Si queda vacía, usamos la descripción del producto post-compra.' })}
          {field('postPurchase', 'ctaText', 'Botón para aceptar la oferta', { maxLength: 60 })}
          {field('postPurchase', 'declineText', 'Botón para continuar sin la oferta', { maxLength: 60 })}
        </Section>
        <Section id="postPurchaseBenefits" number="19" title="Post-compra · Beneficios" description="Qué incluye el producto adicional">{features('postPurchaseBenefits', 'beneficio post-compra', 6)}</Section>
        <Section id="postPurchaseVideo" number="20" title="Post-compra · Video VSL" description="Activá una presentación en video para esta oferta">
          {field('postPurchaseVideo', 'url', 'URL del video VSL', { type: 'url', maxLength: 2000, placeholder: 'https://', hint: 'YouTube, Vimeo o un enlace HTTPS directo a MP4, WebM u OGV. El video aparece al activar el switch.' })}
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><Switch aria-label="Mostrar video VSL en post-compra" checked={content.postPurchaseVideo.enabled} disabled={Boolean(busy) || !content.postPurchaseVideo.url.trim()} onCheckedChange={enabled => change('postPurchaseVideo', { enabled })} />Mostrar video VSL en post-compra</label>
          {field('postPurchaseVideo', 'title', 'Título del video (opcional)', { maxLength: 120 })}
          <p className="text-xs leading-6 text-muted-foreground">La IA conserva la URL y el switch. Con el VSL apagado se muestra la portada del producto.</p>
        </Section>
        <Section id="postPurchaseDownsell" number="21" title="Post-compra · Oferta con descuento" description="El cierre que aparece si rechazan la oferta inicial">
          <p className="text-xs leading-6 text-muted-foreground">Este bloque aparece solo si configurás un descuento en Oferta post-compra. El importe y el porcentaje se calculan automáticamente.</p>
          {field('postPurchase', 'downsellTitle', 'Título de la oferta con descuento', { maxLength: 160 })}
          {field('postPurchase', 'downsellText', 'Texto de la oferta con descuento', { multiline: true, maxLength: 1200 })}
          {field('postPurchase', 'downsellCtaText', 'Botón para aceptar el descuento', { maxLength: 60 })}
          <Button type="button" variant="outline" disabled={!preview?.postPurchaseOffer?.downsellPrice} onClick={() => { setPreviewTarget('post-downsell'); setShowPreview(true); }}><Eye aria-hidden="true" />Ver oferta con descuento</Button>
        </Section>
        <div ref={errorRef} tabIndex={-1}><ErrorAlert>{error}</ErrorAlert></div>
        <div className="landing-save-bar"><div className="flex flex-wrap gap-3"><Button type="submit" name="action" value="save" variant="outline" disabled={Boolean(busy)}>{busy === 'save' && <LoaderCircle className="animate-spin" aria-hidden="true" />}Guardar borrador</Button><Button type="submit" name="action" value="publish" disabled={Boolean(busy)}>{busy === 'publish' && <LoaderCircle className="animate-spin" aria-hidden="true" />}Guardar y publicar</Button></div><p className="text-xs leading-5 text-muted-foreground" role="status">{notice || (dirty ? 'Cambios sin guardar' : 'Tu borrador está al día')}</p></div>
      </form>
      <aside className="landing-preview-panel"><div className="landing-preview-toolbar"><div><strong>Vista previa</strong><span>La compra está deshabilitada</span></div><div className="flex gap-1"><Button type="button" variant={mode === 'desktop' ? 'secondary' : 'ghost'} size="icon" aria-label="Vista de escritorio" aria-pressed={mode === 'desktop'} onClick={() => setMode('desktop')}><Monitor aria-hidden="true" /></Button><Button type="button" variant={mode === 'mobile' ? 'secondary' : 'ghost'} size="icon" aria-label="Vista de celular" aria-pressed={mode === 'mobile'} onClick={() => setMode('mobile')}><Smartphone aria-hidden="true" /></Button></div></div><div className="border-b p-3"><Field label="Página de la vista previa">{ids => <NativeSelect {...ids} value={previewTarget} onChange={event => setPreviewTarget(event.target.value)}><option value="landing">Landing principal</option><option value="post">Post-compra</option>{preview?.postPurchaseOffer?.downsellPrice > 0 && <option value="post-downsell">Post-compra con descuento</option>}</NativeSelect>}</Field></div>{preview ? <LandingFrame view={preview} mode={mode} target={previewTarget} /> : <p className="p-6 text-sm">Elegí un producto principal para ver la landing.</p>}</aside>
    </div>
  </div>;
}

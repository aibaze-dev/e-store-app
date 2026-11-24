import { mainDiscountPrices } from '../../shared/post-purchase.js';
import { POST_LABEL_FIELDS, POST_LABEL_GROUPS, POST_LABEL_DEFAULTS, POST_OPTIONAL_FIELDS, POST_OPTION_FIELDS, POPUP_OPTION_FIELDS, LANDING_EXIT_FIELDS, LANDING_EXIT_OPTIONAL_FIELDS, BACK_POPUP_FIELDS, BACK_POPUP_OPTIONAL_FIELDS, postOptions, popupOptions, landingExitConfig, backPopupConfig, PURCHASE_PREVIEW_STATES, POPUP_PREVIEW_TARGETS } from '../../shared/purchase-copy.js';
import { CHECKOUT_FIELDS, CHECKOUT_DEFAULTS, CHECKOUT_OPTIONAL_FIELDS } from '../../shared/checkout-copy.js';
import { CopyFields, CopyGroup, OptionFields } from './PurchaseCopyFields.jsx';
import PopupJourney from './PopupJourney.jsx';
import { LANDING_LABEL_FIELDS } from '../../shared/landing-copy.js';
import { Tabs } from 'radix-ui';
import CheckoutContentFields from './CheckoutContentFields.jsx';
import { checkoutConfig } from '../../shared/checkout-copy.js';
import { LANDING_SECTIONS as SECTIONS, LANDING_TABS, landingSectionTab } from '../../shared/landing-sections.js';
import { classicAccent } from '../../shared/classic-design.js';
import { discountedPrice } from '@/storefront/downsell.js';
import { finalPostPurchasePercent } from '../../shared/post-purchase.js';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { ArrowLeft, ChevronDown, Eye, LoaderCircle, Map as MapIcon, Monitor, Plus, RotateCcw, Smartphone, Trash2, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText, formatDate } from '@/lib/format.js';
import { landingUrls } from '@/lib/site.js';
import { normalizeContent, mergeGeneratedContent } from '@/templates/content.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { ImageField, VideoField, UploadContext, useMediaUpload } from './ImageField.jsx';
import { Switch } from '@/components/ui/switch';
import { ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';
import StoreOfferSummary from './StoreOfferSummary.jsx';
import LandingFrame from './LandingFrame.jsx';
import LandingWizard from './LandingWizard.jsx';
import TranslateControl from './TranslateControl.jsx';
import { landingAttention } from './landing-attention.js';

const MARKS = 'Usá *asteriscos* para resaltar una parte y **dobles** para negrita.';
const newFeature = () => ({ title: '', description: '', icon: 'check' });
const newTestimonial = () => ({ name: '', quote: '', photoUrl: '', imageUrl: '', verified: false, format: 'quote', openingMessage: '', closingMessage: '' });
const slug = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/, '');


// One form per landing section, in the order the visitor sees them. The header carries
// what the section still needs, so nothing has to be opened to find out.
function Section({ id, description, hidden = false, attention, children, defaultOpen = false }) {
  const [number, title] = SECTIONS[id];
  const needs = hidden ? [] : attention?.needs ?? [];
  const extras = hidden ? [] : attention?.extras ?? [];
  const list = items => <ul>{items.map((item, index) => <li key={index}>{item.text}</li>)}</ul>;
  return <details id={id} className={`landing-form-section ${needs.length > 0 ? 'needs-attention' : ''}`} open={defaultOpen || undefined}>
    <summary><span className="landing-section-number">{number}</span><span><strong>{title}{hidden && <em className="landing-section-off">Oculta</em>}</strong><small>{description}</small>
      {(needs.length > 0 || extras.length > 0) && <span className="landing-section-flags">
        {needs.length > 0 && <em className="landing-flag is-need"><TriangleAlert aria-hidden="true" />{needs.length === 1 ? needs[0].label : `${needs.length} pendientes`}</em>}
        {extras.length > 0 && <em className="landing-flag">{extras.length === 1 ? `Opcional: ${extras[0].label.toLowerCase()}` : `${extras.length} opcionales`}</em>}
      </span>}
    </span><ChevronDown aria-hidden="true" /></summary>
    <div className="landing-section-fields">
      {needs.length > 0 && <div className="landing-attention is-need" role="note"><strong><TriangleAlert aria-hidden="true" />Necesita tu atención</strong>{list(needs)}</div>}
      {extras.length > 0 && <div className="landing-attention" role="note"><strong>Opcional · la IA no lo completa</strong>{list(extras)}</div>}
      {children}
    </div>
  </details>;
}

export default function LandingEditPage() {
  const { storeId } = useParams();
  const { hash } = useLocation();
  const landing = useQuery(api.landings.getForStore, { storeId });
  const store = useQuery(api.stores.get, { id: storeId });
  const products = useQuery(api.products.list, {});
  const saveDraft = useMutation(api.landings.saveDraft);
  const translate = useAction(api.translations.landing);
  const publish = useMutation(api.landings.publish);
  const upload = useMediaUpload();
  if (landing === undefined || !store || !products) return <PageSkeleton label="Cargando landing" />;
  async function save(form, action) {
    await saveDraft({ storeId, template: 'classic', draft: form.content });
    if (action === 'publish') await publish({ storeId });
  }
  return <UploadContext.Provider value={upload}><LandingConfigurator key={storeId} landing={landing} store={store} products={products} hash={hash} uploading={upload.pending} onSave={save} onTranslate={args => translate({ storeId, ...args })} /></UploadContext.Provider>;
}

export function LandingConfigurator({ landing, store, products, hash = '', uploading = false, onSave, onTranslate }) {
  const [form, setForm] = useState(() => ({ subdomain: landing?.subdomain ?? '', content: normalizeContent({ ...landing?.draft, checkout: checkoutConfig({ content: landing?.draft, checkout: store.checkout }) }) }));
  const [saving, setBusy] = useState('');
  const busy = saving || (uploading ? 'upload' : '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('mobile');
  const [activeTab, setActiveTab] = useState(() => landingSectionTab(hash.slice(1)));
  const [previewTarget, setPreviewTarget] = useState(hash.startsWith('#popup') ? 'popup-exit-landing' : hash.startsWith('#checkout') ? 'checkout' : hash.startsWith('#postPurchase') ? 'post' : 'landing');
  const [previewRevision, setPreviewRevision] = useState(0);
  const [postState, setPostState] = useState('offer');
  const [checkoutState, setCheckoutState] = useState('ready');
  const [showPreview, setShowPreview] = useState(false);
  // Post-purchase preview: the modal as the buyer sees it, or its content laid out as a page.
  const [postAsModal, setPostAsModal] = useState(true);
  const [saved, setSaved] = useState(() => JSON.stringify(form));
  const errorRef = useRef(null);
  const content = form.content;
  const storeId = store._id;
  const dirty = JSON.stringify(form) !== saved;
  const pending = landing?.published && JSON.stringify(landing.published) !== JSON.stringify(landing.draft);
  useEffect(() => {
    if (hash) openSection(hash.slice(1));
  }, [hash]);
  useEffect(() => {
    if (!dirty && !uploading) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, uploading]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const change = (key, patch) => { setNotice(''); setForm(current => ({ ...current, content: { ...current.content, [key]: { ...current.content[key], ...patch } } })); };
  const field = (key, property, label, { multiline = false, hint, ...props } = {}) => <Field label={label} hint={hint}>{ids => {
    const Control = multiline ? Textarea : Input;
    return <Control {...ids} value={content[key][property] ?? ''} onChange={event => change(key, { [property]: event.target.value, ...(key === 'postPurchaseVideo' && property === 'url' && !event.target.value.trim() ? { enabled: false } : {}) })} disabled={Boolean(busy)} {...props} />;
  }}</Field>;
  const labels = section => <fieldset className="landing-item-fields"><legend>Textos adicionales</legend>{Object.entries(LANDING_LABEL_FIELDS).filter(([, config]) => config.section === section).map(([key, config]) => <div key={key}>{field('labels', key, config.label, { maxLength: 240, hint: config.hint })}</div>)}</fieldset>;
  const numberField = (key, property, label, max, step = 1) => <Field label={label}>{ids => <Input {...ids} type="number" min="0" max={max} step={step} value={content[key][property] ?? ''} onChange={event => change(key, { [property]: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={Boolean(busy)} />}</Field>;
  const toggle = (key, label = 'Mostrar esta sección', property = 'enabled') => <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-5 accent-primary" checked={content[key][property]} onChange={event => change(key, { [property]: event.target.checked })} disabled={Boolean(busy)} />{label}</label>;
  const image = (key, property, label, hint) => <ImageField uploadOnly label={label} hint={hint} value={content[key][property]} onChange={value => change(key, { [property]: value })} disabled={Boolean(busy)} />;
  // Label, title and subtitle of a section: what the visitor reads first.
  const heading = (key, { eyebrow = true, subtitle = true } = {}) => <>
    {toggle(key)}
    {eyebrow && field(key, 'eyebrow', 'Etiqueta sobre el título (opcional)', { maxLength: 120 })}
    {field(key, 'title', 'Título', { multiline: true, rows: 2, maxLength: 120, hint: `${MARKS} Un salto de línea corta el título en ese punto.` })}
    {subtitle && field(key, 'subtitle', 'Subtítulo (opcional)', { maxLength: 400 })}
  </>;
  const button = (key, label = 'Texto del botón (opcional)') => field(key, 'ctaText', label, { maxLength: 60, hint: 'Si queda vacío, usamos el botón principal.' });
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
  // The server already saved the copied landing as the draft (and copied the store's offer);
  // the form only loads it, with the checkout texts on top of this store's settings.
  const applyCloned = copied => {
    const next = {
      subdomain: form.subdomain || slug(store.name),
      content: normalizeContent({ ...copied, checkout: checkoutConfig({ content: copied, checkout: store.checkout }) }),
    };
    setError(''); setForm(next); setSaved(JSON.stringify(next)); setShowPreview(true);
    setNotice('Landing y oferta copiadas. La landing quedó como borrador: revisá los textos y publicala.');
  };
  // Translates what the form shows now, unsaved changes included, and saves it as the draft.
  const applyTranslation = async language => {
    const { content: translated, kept } = await onTranslate({ language, content: form.content });
    const next = { ...form, subdomain: form.subdomain || slug(store.name), content: normalizeContent(translated) };
    setError(''); setNotice(''); setForm(next); setShowPreview(true);
    try {
      await onSave(next, 'save');
      setSaved(JSON.stringify(next));
      setNotice(`Landing traducida y guardada como borrador.${kept ? ` ${kept} textos quedaron como estaban porque la traducción cambiaba sus variables entre llaves.` : ''} Revisala y publicala.`);
    } catch (failure) { setError(`La landing se tradujo, pero no se pudo guardar. ${errorText(failure, 'Revisá el formulario y guardá el borrador.')}`); }
  };
  const changeItem = (key, index, patch) => change(key, { items: content[key].items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const itemField = (key, index, property, label, { multiline = false, ...props } = {}) => <Field label={label}>{ids => {
    const Control = multiline ? Textarea : Input;
    return <Control {...ids} value={content[key].items[index][property] || ''} onChange={event => changeItem(key, index, { [property]: event.target.value })} disabled={Boolean(busy)} {...props} />;
  }}</Field>;
  const remove = (key, index, label) => <Button type="button" variant="ghost" className="text-destructive" disabled={Boolean(busy)} onClick={() => change(key, { items: content[key].items.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" />Quitar {label} {index + 1}</Button>;
  const add = (key, label, item, max) => <Button type="button" variant="outline" disabled={Boolean(busy) || content[key].items.length >= max} onClick={() => change(key, { items: [...content[key].items, item] })}><Plus aria-hidden="true" />Agregar {label}</Button>;
  const features = (key, label, max, descriptionLabel = 'Descripción (opcional)') => <>{content[key].items.length === 0 && <p className="text-sm text-muted-foreground">Agregá {label} para mostrar esta sección.</p>}{content[key].items.map((item, index) => <fieldset key={index} className="landing-item-fields"><legend>{label} {index + 1}</legend>
    {itemField(key, index, 'title', 'Título', { maxLength: 240, required: true })}
    {itemField(key, index, 'description', descriptionLabel, { multiline: true, maxLength: 600 })}
    {remove(key, index, label)}
  </fieldset>)}{add(key, label, newFeature(), max)}</>;
  const itemImage = (key, index, property, label) => <ImageField uploadOnly compact label={label} value={content[key].items[index][property]} onChange={value => changeItem(key, index, { [property]: value })} disabled={Boolean(busy)} />;
  const off = key => !content[key].enabled;

  const mainProduct = products.find(product => product._id === store.offer.mainProductId);
  const postProduct = products.find(product => product._id === store.postPurchase.productId);
  const referencePrice = (product, fallback) => product.referencePrice === undefined ? fallback : product.referencePrice?.currency.toUpperCase() === store.currency.toUpperCase() ? product.referencePrice.value : undefined;
  const preview = mainProduct ? {
    postPurchaseOffer: store.postPurchase.enabled && postProduct ? {
      ...postProduct, price: store.postPurchase.price,
      ...(store.postPurchase.downsellPercent ? { downsellPercent: store.postPurchase.downsellPercent, downsellPrice: discountedPrice(store.postPurchase.price, store.postPurchase.downsellPercent) } : {}),
      finalPercent: finalPostPurchasePercent(store.postPurchase), finalPrice: discountedPrice(store.postPurchase.price, finalPostPurchasePercent(store.postPurchase)),
    } : null,
    subdomain: form.subdomain, checkout: store.checkout,
    downsell: store.downsell?.enabled ? { ...store.downsell, ...mainDiscountPrices(store.offer.price, store.downsell.percent) } : null,
    content, store: { name: store.name, currency: store.currency },
    offer: {
      main: { ...mainProduct, price: store.offer.price, compareAtPrice: referencePrice(mainProduct, store.offer.compareAtPrice) },
      bonuses: store.offer.bonuses.flatMap(bonus => {
        const product = products.find(item => item._id === bonus.productId);
        return product ? [{ ...product, productId: bonus.productId, referenceValue: bonus.referenceValue }] : [];
      }),
      upsells: [...store.offer.upsells].sort((a, b) => a.displayOrder - b.displayOrder).flatMap(upsell => {
        const product = products.find(item => item._id === upsell.productId);
        const reference = product ? referencePrice(product, store.checkout?.upsellReferences?.find(item => item.productId === upsell.productId)?.value ?? 0) : 0;
        return product ? [{ ...product, productId: upsell.productId, price: upsell.price, ...(reference > upsell.price ? { compareAtPrice: reference } : {}) }] : [];
      }),
    },
  } : null;
  const urls = landing?.subdomain ? landingUrls(landing.subdomain) : null;
  const checks = landingAttention(content, { bonuses: preview?.offer.bonuses.length ?? 0, upsells: preview?.offer.upsells.length ?? 0, hasCover: Boolean(mainProduct?.coverUrl) });
  const flagged = Object.keys(SECTIONS).filter(id => checks[id] && landingSectionTab(id) === activeTab);
  const todo = flagged.flatMap(id => checks[id].needs.map(item => ({ id, text: item.text })));
  const optional = flagged.reduce((total, id) => total + checks[id].extras.length, 0);
  function selectTab(tab) {
    setActiveTab(tab);
    setShowPreview(false);
    setPreviewTarget(tab === 'popups' ? 'popup-exit-landing' : tab === 'checkout' ? 'checkout' : tab === 'post' ? 'post' : 'landing');
  }
  function openSection(id) {
    selectTab(landingSectionTab(id));
    if (id === 'popupCheckout') setPreviewTarget('popup-exit-checkout');
    if (id === 'popupBack') setPreviewTarget('popup-back-checkout');
    if (id === 'popupPost') setPreviewTarget('post');
    if (id === 'postPurchaseDownsell') setPreviewTarget('post-downsell');
    if (id === 'postPurchaseFinal') setPreviewTarget('post-final');
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      if (!element) return;
      element.open = true;
      element.scrollIntoView({ block: 'start' });
      element.querySelector('summary')?.focus();
    });
  }

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

  const sectionForms = {
    landing: <>
        <Section id="promotion" attention={checks.promotion} description="La franja fija de arriba con el contador y los avisos de compra" hidden={!content.promotion.enabled} defaultOpen>
          {toggle('promotion', 'Mostrar la barra de oferta')}
          {field('promotion', 'title', 'Título de la barra superior', { maxLength: 160, placeholder: mainProduct?.name, hint: 'Si queda vacío, usamos el nombre del producto principal.' })}
          {field('promotion', 'message', 'Mensaje de la oferta', { maxLength: 120, placeholder: 'Oferta de lanzamiento', hint: 'Se muestra junto al nombre del producto y al contador.' })}
          <p className="text-xs leading-6 text-muted-foreground">El contador es simulado: cada visita arranca cerca de los 15 minutos, se comparte con el checkout y vuelve a empezar al llegar a cero. No modifica precios ni bloquea pagos.</p>
          {field('promotion', 'spotsText', 'Texto de cupos', { maxLength: 240, hint: 'Usá {cantidad} para insertar los cupos disponibles.' })}
          {numberField('promotion', 'remainingSpots', 'Cupos disponibles (opcional)', 1000000)}
          <p className="text-xs leading-6 text-muted-foreground">Los cupos se muestran debajo del botón principal cuando cargás una cantidad.</p>
          {toggle('activity', 'Mostrar personas viendo (simulado)', 'viewers')}
          {field('activity', 'viewersText', 'Texto de personas viendo', { maxLength: 240, hint: 'Usá {cantidad} para insertar el número de personas.' })}
          {toggle('activity', 'Mostrar la cantidad de ventas (simulado)', 'salesCount')}
          {field('activity', 'salesText', 'Texto del contador de ventas', { maxLength: 240, hint: 'Usá {cantidad} para insertar un número aleatorio entre 540 y 6490. Se mantiene estable mientras la landing está abierta y no depende de pagos reales.' })}
          {toggle('activity', 'Mostrar avisos de compra de ejemplo', 'notifications')}
          {field('activity', 'purchaseText', 'Texto del aviso de compra', { maxLength: 240, hint: 'Usá {nombre} para insertar el nombre.' })}
          {field('activity', 'purchaseLocationText', 'Texto de ubicación del aviso', { maxLength: 240, hint: 'Usá {ciudad} para insertar la ubicación.' })}
          <p className="text-xs leading-6 text-muted-foreground">Los avisos de ejemplo muestran nombres ficticios y ciudades de Estados Unidos y Europa.</p>
        </Section>
        <Section id="hero" attention={checks.hero} description="La franja naranja: promesa, precio y primer botón">
          {field('hero', 'eyebrow', 'Etiqueta sobre el título (opcional)', { maxLength: 120, placeholder: 'En 7 días' })}
          {field('hero', 'title', 'Título principal', { multiline: true, maxLength: 160, placeholder: 'Aprendé a usar Claude desde cero en 7 días y', hint: 'La primera parte del título, en el color base del encabezado.' })}
          {field('hero', 'titleAccent', 'Título principal accent', { multiline: true, maxLength: 160, placeholder: 'tené un asistente que te deja el trabajo hecho', hint: 'Se muestra a continuación, con el color destacado. Opcional; no necesitás usar asteriscos.' })}
          {field('hero', 'subtitle', 'Subtítulo', { multiline: true, maxLength: 400 })}
          {field('hero', 'headerCtaText', 'Texto del botón del encabezado', { maxLength: 60, hint: 'Si queda vacío, usamos el botón principal.' })}
        </Section>
        <Section id="cover" attention={checks.cover} description="Las fotos principales, la calificación y el botón de compra">
          {image('hero', 'imageUrl', 'Foto principal', 'Si no subís ninguna, usamos la portada del producto.')}
          {image('hero', 'secondaryImageUrl', 'Segunda foto (opcional)', 'Se muestra al lado de la principal, las dos cuadradas.')}
          {numberField('socialProof', 'rating', 'Calificación con estrellas (0 a 5, opcional)', 5, 0.1)}
          {field('hero', 'ratingText', 'Texto junto a la calificación (opcional)', { maxLength: 120, placeholder: 'La guía definitiva · Edición 2026' })}
          {field('hero', 'ctaText', 'Texto del botón principal', { maxLength: 60 })}
          {field('hero', 'trustText', 'Línea debajo del botón', { maxLength: 160, placeholder: '15 min por día · Descarga inmediata · Garantía 7 días', hint: 'Si queda vacía, mostramos acceso inmediato, pago seguro y la garantía.' })}
          {field('hero', 'noteTitle', 'Aclaración: pregunta (opcional)', { maxLength: 120, placeholder: '¿Necesito pagar algo aparte?' })}
          {field('hero', 'note', 'Aclaración: respuesta', { multiline: true, maxLength: 240 })}
          {field('hero', 'footnote', 'Nota de formato (opcional)', { maxLength: 160, placeholder: 'Guía 100% digital · incluye versión para imprimir', hint: 'Se repite al pie del cierre.' })}
          <p className="text-xs leading-6 text-muted-foreground">El precio de venta se configura en la oferta de la tienda. El precio tachado sale del precio normal del producto principal o, en tiendas anteriores, de la oferta.</p>
          {labels('cover')}
        </Section>
        <Section id="introduction" attention={checks.introduction} description="La pregunta y los párrafos que siguen a la portada" hidden={off('introduction')}>
          {heading('introduction', { eyebrow: false, subtitle: false })}
          {field('introduction', 'text', 'Texto', { multiline: true, rows: 8, maxLength: 2400, hint: `Separá los párrafos con un salto de línea. ${MARKS}` })}
          {field('introduction', 'badge', 'Frase destacada al final (opcional)', { maxLength: 120, placeholder: 'Acceso inmediato. Tu día 1 empieza hoy.' })}
        </Section>
        <Section id="transformation" attention={checks.transformation} description="Título y una foto grande que muestra el cambio" hidden={off('transformation')}>
          {heading('transformation')}
          {image('transformation', 'imageUrl', 'Foto del antes y después', 'La sección se publica cuando tiene su foto.')}
          {field('transformation', 'imageAlt', 'Descripción de la foto', { maxLength: 240, hint: 'Para quienes usan un lector de pantalla.' })}
        </Section>
        <Section id="painPoints" attention={checks.painPoints} description="Los problemas con los que el lector se identifica" hidden={off('painPoints')}>
          {heading('painPoints')}
          {features('painPoints', 'problema', 12, 'Subtítulo del problema (opcional)')}
          {field('painPoints', 'closingText', 'Frase de cierre (opcional)', { maxLength: 240 })}
          {button('painPoints')}
        </Section>
        <Section id="offer" attention={checks.offer} description="El carrusel oscuro con las portadas de los bonos gratis" hidden={off('bonuses')}>
          {heading('bonuses')}
          <fieldset className="landing-item-fields"><legend>Etiquetas bajo el subtítulo</legend>{[0, 1, 2, 3].map(index => <Field key={index} label={`Etiqueta ${index + 1} (opcional)`}>{ids => <Input {...ids} maxLength={40} value={content.bonuses.chips[index] ?? ''} disabled={Boolean(busy)}
            onChange={event => change('bonuses', { chips: [0, 1, 2, 3].map(i => i === index ? event.target.value : content.bonuses.chips[i] ?? '') })} />}</Field>)}</fieldset>
          {button('bonuses')}
          {field('bonuses', 'note', 'Nota debajo del botón (opcional)', { maxLength: 240 })}
          <StoreOfferSummary store={store} products={products} openInNewTab />
          <p className="text-xs leading-6 text-muted-foreground">Cada tarjeta del carrusel usa la portada, el nombre y la descripción del producto bono. Para cambiar una foto, editá ese producto. Estos enlaces abren otra pestaña para que conserves lo que estás escribiendo.</p>
          {labels('offer')}
        </Section>
        <Section id="steps" attention={checks.steps} description="Los pasos numerados del recorrido" hidden={off('steps')}>
          {heading('steps')}
          {features('steps', 'paso', 7)}
        </Section>
        <Section id="about" attention={checks.about} description="La foto del equipo y su historia" hidden={off('about')}>
          {heading('about')}
          {image('about', 'imageUrl', 'Foto del equipo')}
          {field('about', 'imageAlt', 'Descripción de la foto', { maxLength: 240 })}
          {field('about', 'text', 'Texto', { multiline: true, rows: 8, maxLength: 2400, hint: `Separá los párrafos con un salto de línea. ${MARKS}` })}
          {field('about', 'signature', 'Firma', { maxLength: 120, placeholder: 'El equipo de…' })}
        </Section>
        <Section id="showcase" attention={checks.showcase} description="Una foto o un video grande con todo lo que recibe el comprador" hidden={off('showcase')}>
          {heading('showcase')}
          {image('showcase', 'imageUrl', 'Foto del contenido', 'La sección se publica cuando tiene su foto o su video. Si además cargás un video, se usa como imagen de espera.')}
          {field('showcase', 'imageAlt', 'Descripción de la foto o del video', { maxLength: 240 })}
          <VideoField label="Video del contenido (opcional)" value={content.showcase.videoUrl} onChange={videoUrl => change('showcase', { videoUrl })} disabled={Boolean(busy)} hint="Se reproduce en silencio con el botón ‘Tocá para escuchar’." />
        </Section>
        <Section id="benefits" attention={checks.benefits} description="La lista numerada de lo que incluye y el recuadro con el precio" hidden={off('benefits')}>
          {heading('benefits')}
          {image('benefits', 'imageUrl', 'Foto del kit (opcional)', 'Si además cargás un video, se usa como imagen de espera.')}
          {field('benefits', 'imageAlt', 'Descripción de la foto o del video', { maxLength: 240 })}
          <VideoField label="Video del kit (opcional)" value={content.benefits.videoUrl} onChange={videoUrl => change('benefits', { videoUrl })} disabled={Boolean(busy)} hint="Se reproduce en silencio con el botón ‘Tocá para escuchar’." />
          {features('benefits', 'elemento', 12)}
          <fieldset className="landing-item-fields"><legend>Recuadro con el precio</legend>
            {toggle('summary', 'Mostrar el recuadro con el valor total y el precio de hoy')}
            {button('summary')}
            {field('summary', 'note', 'Nota debajo del botón (opcional)', { maxLength: 240, placeholder: 'Precio de lanzamiento · Descarga inmediata · Garantía 7 días' })}
          </fieldset>
          {labels('benefits')}
        </Section>
        <Section id="socialProof" attention={checks.socialProof} description="Las tarjetas con foto, estrellas y opinión" hidden={off('socialProof')}>
          {heading('socialProof')}
          {content.socialProof.items.length === 0 && <p className="text-sm text-muted-foreground">Agregá un testimonio para mostrar esta sección.</p>}
          {content.socialProof.items.map((item, index) => <fieldset key={index} className="landing-item-fields"><legend>Testimonio {index + 1}</legend>
            {itemField('socialProof', index, 'name', 'Nombre y ciudad', { maxLength: 120, required: true, placeholder: 'Marta S. · Córdoba' })}
            {itemImage('socialProof', index, 'photoUrl', 'Foto de la persona')}
            {itemField('socialProof', index, 'quote', 'Opinión', { multiline: true, maxLength: 1200 })}
            {itemImage('socialProof', index, 'imageUrl', 'Captura o tarjeta ya diseñada (opcional)')}
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={Boolean(item.verified)} disabled={Boolean(busy)} onChange={event => changeItem('socialProof', index, { verified: event.target.checked })} />Mostrar el sello “Compra verificada”</label>
            {remove('socialProof', index, 'testimonio')}
          </fieldset>)}
          {add('socialProof', 'testimonio', newTestimonial(), 12)}
          <fieldset className="landing-item-fields"><legend>Métricas debajo de los testimonios</legend>
            <p className="text-xs text-muted-foreground">Completalas con tus datos. Las que quedan vacías no se muestran. La calificación y los clientes también aparecen junto a las estrellas de la portada.</p>
            {numberField('socialProof', 'rating', 'Calificación (0 a 5)', 5, 0.1)}
            {numberField('socialProof', 'customers', 'Cantidad de clientes', 100000000)}
            {numberField('socialProof', 'satisfaction', 'Satisfacción (%)', 100)}
          </fieldset>
          <p className="text-xs leading-6 text-muted-foreground">Si cargás solo la captura, se muestra esa imagen como tarjeta. Marcá “Compra verificada” únicamente en opiniones de compradores reales. Los testimonios cargados a mano se conservan al volver a generar con IA.</p>
          {button('socialProof')}
          {labels('socialProof')}
        </Section>
        <Section id="comparison" attention={checks.comparison} description="Hasta tres columnas, con tu producto destacado" hidden={off('comparison')}>
          {heading('comparison', { eyebrow: false })}
          {content.comparison.items.map((item, index) => <fieldset key={index} className="landing-item-fields"><legend>Columna {index + 1}</legend>
            {itemField('comparison', index, 'title', 'Nombre del camino', { maxLength: 120, required: true })}
            {itemField('comparison', index, 'description', 'Características', { multiline: true, rows: 4, maxLength: 600, required: true })}
            <p className="text-xs text-muted-foreground">Escribí una característica por línea.</p>
            <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={item.highlighted} disabled={Boolean(busy)} onChange={event => change('comparison', { items: content.comparison.items.map((entry, i) => ({ ...entry, highlighted: i === index ? event.target.checked : false })) })} />Es mi producto: destacarla con tildes y botón</label>
            {remove('comparison', index, 'columna')}
          </fieldset>)}
          {add('comparison', 'columna', { title: '', description: '', highlighted: false }, 3)}
          {field('comparison', 'badge', 'Etiqueta de la columna destacada (opcional)', { maxLength: 60, placeholder: 'El camino corto' })}
          {button('comparison', 'Botón de la columna destacada (opcional)')}
        </Section>
        <Section id="guarantee" attention={checks.guarantee} description="El recuadro punteado con las condiciones" hidden={off('guarantee')}>
          {toggle('guarantee')}
          <Field label="Días de garantía (opcional)">{ids => <Input {...ids} type="number" min="1" max="365" step="1" value={content.guarantee.days ?? ''} onChange={event => change('guarantee', { days: event.target.value === '' ? undefined : Number(event.target.value) })} disabled={Boolean(busy)} />}</Field>
          {field('guarantee', 'title', 'Título', { maxLength: 120 })}
          {field('guarantee', 'text', 'Condiciones de la garantía', { multiline: true, maxLength: 1200, hint: 'La garantía aparece cuando completás este texto.' })}
          {button('guarantee')}
        </Section>
        <Section id="faq" attention={checks.faq} description="Las dudas que respondés antes de la compra" hidden={off('faq')}>
          {heading('faq', { eyebrow: false })}
          {content.faq.items.map((item, index) => <fieldset key={index} className="landing-item-fields"><legend>Pregunta {index + 1}</legend>{itemField('faq', index, 'question', 'Pregunta', { maxLength: 240, required: true })}{itemField('faq', index, 'answer', 'Respuesta', { multiline: true, maxLength: 1200, required: true })}{remove('faq', index, 'pregunta')}</fieldset>)}
          {add('faq', 'pregunta', { question: '', answer: '' }, 20)}
        </Section>
        <Section id="closing" attention={checks.closing} description="La franja oscura con la última invitación a comprar" hidden={off('closing')}>
          {toggle('closing')}
          {field('closing', 'title', 'Título final', { maxLength: 160, hint: `Si queda vacío, usamos el título principal. ${MARKS}` })}
          {field('closing', 'text', 'Texto (opcional)', { multiline: true, maxLength: 600 })}
          {field('closing', 'ctaText', 'Texto del botón final', { maxLength: 60 })}
          {field('closing', 'note', 'Línea debajo del botón (opcional)', { maxLength: 240, placeholder: 'Descarga inmediata · Garantía 7 días · Actualización mensual' })}
        </Section>
        <Section id="combo" attention={checks.combo} description="El resumen de la compra con los extras y el botón que acompaña al pie" hidden={off('combo')}>
          {toggle('combo', 'Mostrar el armado de la compra con los extras')}
          <p className="text-xs leading-6 text-muted-foreground">{store.offer.upsells.length > 0 ? 'Lista los extras de la tienda con sus precios. Con este bloque activo, los botones de la landing llevan hasta acá y el pago se inicia desde su botón.' : 'Esta tienda no tiene extras cargados: el bloque no se muestra y los botones van directo al checkout.'} <Link to={`/panel/tiendas/${storeId}/productos#upsells`} target="_blank" rel="noreferrer" className="underline">Configurar extras y precios</Link></p>
          <p className="text-xs leading-6 text-muted-foreground">Las portadas, descripciones cortas, precios tachados y destacados se configuran en cada producto. Los porcentajes se calculan automáticamente. <Link to={`/panel/tiendas/${storeId}/catalogo`} className="underline">Editar productos</Link></p>
          {field('combo', 'eyebrow', 'Etiqueta', { maxLength: 120 })}
          {field('combo', 'title', 'Título', { maxLength: 120 })}
          {field('combo', 'upsellText', 'Frase sobre los extras', { maxLength: 120 })}
          {field('combo', 'allText', 'Botón para sumar todos los extras', { maxLength: 60 })}
          {field('combo', 'ctaText', 'Botón para ir a pagar', { maxLength: 60 })}
          {field('combo', 'note', 'Nota debajo del botón', { maxLength: 240 })}
          {toggle('closing', 'Mostrar el botón fijo al pie de la pantalla', 'stickyEnabled')}
          {labels('combo')}
        </Section>
        <Section id="identity" attention={checks.identity} description="Color, marca, enlaces legales y dirección pública">
          <Field label="Color principal" hint="Los botones ajustan su contraste automáticamente.">{ids => <div className="flex items-center gap-3"><input {...ids} type="color" className="h-11 w-14 cursor-pointer rounded border" value={classicAccent(content.style.accentColor)} onChange={event => change('style', { accentColor: event.target.value })} disabled={Boolean(busy)} /><span className="text-sm text-muted-foreground">{classicAccent(content.style.accentColor)}</span></div>}</Field>
          {field('footer', 'brandName', 'Marca en el pie de página', { maxLength: 120, hint: 'Si queda vacío, usamos el nombre de la tienda.' })}
          {field('footer', 'termsUrl', 'Términos y condiciones (URL)', { type: 'url' })}{field('footer', 'privacyUrl', 'Política de privacidad (URL)', { type: 'url' })}
          <p className="text-xs leading-6 text-muted-foreground">{urls ? <>Dirección pública: <a href={urls.path} target="_blank" rel="noreferrer" className="break-all underline">{urls.path}</a>. </> : 'Todavía no definiste el subdominio. '}El subdominio se edita en <Link to={`/panel/tiendas/${storeId}/configuracion`} className="underline">Configuración</Link>; el dominio propio requiere configurar dominio y DNS.</p>
          {labels('identity')}
        </Section>
    </>,
    post: <>
      <Section id="postPurchaseCopy" description="Gracias, accesos, estados del pago y textos secundarios" defaultOpen>
        <OptionFields fields={POST_OPTION_FIELDS} value={postOptions(content)} onChange={patch => change('postOptions', patch)} disabled={Boolean(busy)} />
        <p className="text-sm leading-6 text-muted-foreground">Los textos del formulario de pago y el idioma de Stripe se comparten con la pestaña Checkout. En Popups podés ver cuándo aparece cada oferta.</p>
        <div className="grid gap-3">{Object.entries(POST_LABEL_GROUPS).map(([group, title]) => {
          const fields = Object.fromEntries(Object.entries(POST_LABEL_FIELDS).filter(([, field]) => field.group === group));
          return <CopyGroup key={group} title={title} count={Object.keys(fields).length}><CopyFields fields={fields} value={content.postLabels} defaults={POST_LABEL_DEFAULTS} optional={POST_OPTIONAL_FIELDS} onChange={patch => change('postLabels', patch)} disabled={Boolean(busy)} /></CopyGroup>;
        })}</div>
      </Section>
        <Section id="postPurchase" attention={checks.postPurchase} description="La oferta que se muestra después del pago">
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
        <Section id="postPurchaseBenefits" attention={checks.postPurchaseBenefits} description="Qué incluye el producto adicional">{toggle('postPurchaseBenefits')}{field('postPurchaseBenefits', 'title', 'Título de la sección', { maxLength: 120 })}{field('postPurchaseBenefits', 'subtitle', 'Subtítulo (opcional)', { maxLength: 400 })}{features('postPurchaseBenefits', 'beneficio post-compra', 6)}</Section>
        <Section id="postPurchaseVideo" attention={checks.postPurchaseVideo} description="Activá una presentación en video para esta oferta">
          <VideoField label="Video VSL" value={content.postPurchaseVideo.url} onChange={url => change('postPurchaseVideo', { url, ...(!url ? { enabled: false } : {}) })} disabled={Boolean(busy)} hint="Subí el video y activá el switch para mostrarlo." />
          <Field label="Formato del video" hint="Automático usa las proporciones del archivo. También podés elegir el encuadre del modal.">{ids =>
            <NativeSelect {...ids} value={content.postPurchaseVideo.format ?? 'auto'} disabled={Boolean(busy)} onChange={event => change('postPurchaseVideo', { format: event.target.value })}>
              <option value="auto">Automático</option>
              <option value="reel">Reel vertical (9:16)</option>
              <option value="landscape">Horizontal (16:9)</option>
            </NativeSelect>}</Field>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><Switch aria-label="Mostrar video VSL en post-compra" checked={content.postPurchaseVideo.enabled} disabled={Boolean(busy) || !content.postPurchaseVideo.url.trim()} onCheckedChange={enabled => change('postPurchaseVideo', { enabled })} />Mostrar video VSL en post-compra</label>
          {field('postPurchaseVideo', 'title', 'Título del video (opcional)', { maxLength: 120 })}
          <p className="text-xs leading-6 text-muted-foreground">La IA conserva el archivo subido y el switch. Con el VSL apagado se muestra la portada del producto.</p>
        </Section>
        <Section id="postPurchaseDownsell" attention={checks.postPurchaseDownsell} description="Segundo paso del modal: si dicen que no, el mismo producto más barato">
          <p className="text-xs leading-6 text-muted-foreground">Este paso aparece solo si configurás un descuento en Oferta post-compra. El importe y el porcentaje se calculan automáticamente.</p>
          {field('postPurchase', 'downsellTitle', 'Título de la oferta con descuento', { maxLength: 160 })}
          {field('postPurchase', 'downsellText', 'Texto de la oferta con descuento', { multiline: true, maxLength: 1200 })}
          {field('postPurchase', 'downsellCtaText', 'Botón para aceptar el descuento', { maxLength: 60 })}
          <Button type="button" variant="outline" disabled={!preview?.postPurchaseOffer?.downsellPrice} onClick={() => { setPreviewTarget('post-downsell'); setShowPreview(true); }}><Eye aria-hidden="true" />Ver oferta con descuento</Button>
        </Section>
        <Section id="postPurchaseFinal" attention={checks.postPurchaseFinal} description="Último paso: el precio más bajo, cuando el comprador vuelve a la página">
          <p className="text-xs leading-6 text-muted-foreground">Se muestra si el comprador rechazó las ofertas anteriores y vuelve a la pestaña o mueve el mouse fuera de la página. El descuento es 10 puntos más que el de la oferta con descuento (10% si no hay) y se calcula automáticamente.</p>
          {field('postPurchase', 'finalTitle', 'Título de la última oportunidad', { maxLength: 160 })}
          {field('postPurchase', 'finalText', 'Texto de la última oportunidad', { multiline: true, maxLength: 1200 })}
          {field('postPurchase', 'finalCtaText', 'Botón para aceptar el precio final', { maxLength: 60 })}
          <Button type="button" variant="outline" disabled={!preview?.postPurchaseOffer} onClick={() => { setPreviewTarget('post-final'); setShowPreview(true); }}><Eye aria-hidden="true" />Ver última oportunidad</Button>
        </Section>
    </>,
    popups: <>
      <section className="dashboard-card space-y-5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Después del pago</h2>
        <p className="text-sm text-muted-foreground">La oferta post-compra activa se abre al terminar la animación de /gracias.</p>
        <OptionFields fields={Object.fromEntries(['postOnReturn', 'postOnExit', 'postDownsell', 'postFinal'].map(key => [key, POPUP_OPTION_FIELDS[key]]))} value={popupOptions(content)} onChange={patch => change('popupOptions', patch)} disabled={Boolean(busy)} />
        <Link className="inline-block text-sm underline underline-offset-4" to={`/panel/tiendas/${storeId}/downsell`}>Configurar descuento y video de la oferta principal</Link>
      </section>
      <Section id="popupLanding" description="Aviso de salida, una vez por sesión" defaultOpen><CopyFields fields={LANDING_EXIT_FIELDS} value={content.landingExit} defaults={landingExitConfig({ content: { ...content, landingExit: {} } })} optional={LANDING_EXIT_OPTIONAL_FIELDS} onChange={patch => change('landingExit', patch)} disabled={Boolean(busy)} /></Section>
      <Section id="popupCheckout" description="Aviso cuando el mouse sale del checkout">
        <CopyFields maxLength={600} fields={Object.fromEntries(Object.entries(CHECKOUT_FIELDS).filter(([, field]) => field.group === 'exit'))} value={content.checkout} defaults={CHECKOUT_DEFAULTS} optional={CHECKOUT_OPTIONAL_FIELDS} onChange={patch => change('checkout', patch)} disabled={Boolean(busy)} />
      </Section>
      <Section id="popupBack" description="Popup al pedir un descuento y página de la oferta"><CopyFields fields={BACK_POPUP_FIELDS} value={content.backPopup} defaults={backPopupConfig({ content: {}, downsell: store.downsell })} optional={BACK_POPUP_OPTIONAL_FIELDS} onChange={patch => change('backPopup', patch)} disabled={Boolean(busy)} /></Section>
      <Section id="popupPost" description="Oferta inicial, descuento y última oportunidad"><p className="text-sm leading-6">Los títulos, descripciones y botones de estas tres variantes se editan en Post-compra. El mapa superior permite ver cada una y sus estados de pago.</p><Button type="button" variant="outline" onClick={() => selectTab('post')}>Editar textos de post-compra</Button></Section>
    </>,
    checkout: <CheckoutContentFields copy={content.checkout} onChange={patch => change('checkout', patch)} disabled={Boolean(busy)} storeId={storeId} onOpenPopups={() => openSection('popupCheckout')}>
    <Section id="checkoutTimer" description="El texto que acompaña al contador durante el pago" defaultOpen>
      {field('promotion', 'timerLabel', 'Texto del contador en el checkout', { maxLength: 120 })}
      <p className="text-xs leading-6 text-muted-foreground">El contador se comparte con la landing. Cambiar este texto no modifica precios ni bloquea pagos.</p>
    </Section>
    <details className="landing-form-section"><summary><span className="landing-section-number" aria-hidden="true">§</span><span><strong>Enlaces legales y garantía</strong><small>Compartidos con la landing</small></span><ChevronDown aria-hidden="true" /></summary><div className="landing-section-fields">
      {field('footer', 'privacyUrl', 'URL de privacidad', { type: 'url' })}
      {field('footer', 'termsUrl', 'URL de términos', { type: 'url' })}
      {toggle('guarantee', 'Activar garantía')}
      {numberField('guarantee', 'days', 'Días de garantía', 365)}
      {field('guarantee', 'text', 'Condiciones de garantía', { multiline: true, maxLength: 1200 })}
    </div></details>
    </CheckoutContentFields>,
  };

  return <Tabs.Root value={activeTab} onValueChange={selectTab} className="landing-configurator">
    <div className="mb-6 space-y-3">
      <Button asChild variant="ghost" className="-ml-3"><Link to={`/panel/tiendas/${storeId}`}><ArrowLeft aria-hidden="true" />Inicio de la tienda</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-semibold uppercase tracking-widest text-primary">Landing clásica</span><h1 className="mt-2 text-3xl font-semibold tracking-tight">Configurá tu landing</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Elegí qué querés configurar: la landing, post-compra, checkout y popups. Cada pestaña reúne sus propios formularios.</p></div><Button type="button" variant="outline" onClick={() => setShowPreview(value => !value)}><Eye aria-hidden="true" />{showPreview ? 'Volver al formulario' : 'Ampliar vista previa'}</Button></div>
      <p className="text-xs leading-6 text-muted-foreground">{landing?.publishedAt ? `Publicada el ${formatDate(landing.publishedAt)}.` : 'Todavía sin publicar.'} {dirty ? 'Tenés cambios sin guardar.' : pending ? 'Hay un borrador pendiente de publicar.' : ''}</p>
    </div>
    <Tabs.List className="landing-settings-tabs" aria-label="Configuración de la tienda">
      {LANDING_TABS.map(tab => <Tabs.Trigger key={tab.id} value={tab.id} disabled={Boolean(busy)}>{tab.label}</Tabs.Trigger>)}
    </Tabs.List>
    <div hidden={activeTab !== 'landing'}><LandingWizard storeId={storeId} hasContent={Boolean(content.hero.title)} disabled={Boolean(busy)} onApply={applyGenerated} onClone={applyCloned} />
      {onTranslate && content.hero.title && <TranslateControl what="la landing" disabled={Boolean(busy)} onBusy={value => setBusy(value ? 'translate' : '')} onTranslate={applyTranslation} />}</div>
    {(todo.length > 0 || optional > 0) && <section className={`landing-attention-summary ${todo.length > 0 ? 'is-need' : ''}`} aria-labelledby="landing-attention-title">
      <h2 id="landing-attention-title">{todo.length > 0 && <TriangleAlert aria-hidden="true" />}{todo.length > 0 ? `Qué revisar antes de publicar (${todo.length})` : 'Nada pendiente para publicar'}</h2>
      {todo.length > 0 && <ul>{todo.map((item, index) => <li key={index}><button type="button" onClick={() => openSection(item.id)}><span>{SECTIONS[item.id][0]}</span><span><strong>{SECTIONS[item.id][1]}</strong>{item.text}</span></button></li>)}</ul>}
      {optional > 0 && <p>{optional === 1 ? 'Además hay 1 dato opcional que la IA no completa (fotos, cifras o enlaces); está marcado' : `Además hay ${optional} datos opcionales que la IA no completa (fotos, cifras y enlaces); están marcados`} en el encabezado de cada sección.</p>}
    </section>}
    {activeTab === 'popups' && <PopupJourney view={preview} target={previewTarget} onChoose={target => { setPreviewRevision(value => value + 1); setPreviewTarget(target); setPostState('offer'); setShowPreview(true); requestAnimationFrame(() => document.querySelector('.landing-preview-panel')?.scrollIntoView({ block: 'start' })); }} />}
    {LANDING_TABS.map(tab => <Tabs.Content key={tab.id} value={tab.id} forceMount hidden={activeTab !== tab.id} className="landing-settings-panel">
      <div className={`landing-config-grid ${showPreview ? 'preview-expanded' : ''}`}>
        <form onSubmit={submit} onInvalidCapture={event => { for (let section = event.target.closest('details'); section; section = section.parentElement?.closest('details')) section.open = true; }} className="landing-config-form" aria-busy={Boolean(busy)}>
          {sectionForms[tab.id]}
        <div ref={activeTab === tab.id ? errorRef : undefined} tabIndex={-1}><ErrorAlert>{error}</ErrorAlert></div>
        <div className="landing-save-bar"><div className="flex flex-wrap gap-3"><Button type="submit" name="action" value="save" variant="outline" disabled={Boolean(busy)}>{busy === 'save' && <LoaderCircle className="animate-spin" aria-hidden="true" />}Guardar borrador</Button><Button type="submit" name="action" value="publish" disabled={Boolean(busy)}>{busy === 'publish' && <LoaderCircle className="animate-spin" aria-hidden="true" />}Guardar y publicar</Button></div><p className="text-xs leading-5 text-muted-foreground" role="status">{uploading ? 'Subiendo archivo… Esperá para guardar.' : notice || (dirty ? 'Cambios sin guardar' : 'Tu borrador está al día')}</p></div>
        </form>
        {tab.id === activeTab && (
      <aside className="landing-preview-panel"><div className="landing-preview-toolbar"><div><strong>Vista previa</strong><span>{activeTab === 'checkout' || activeTab === 'popups' ? 'Probá los extras y revisá los textos sin realizar pagos' : 'Hacé clic en una sección para editarla'}</span></div><div className="flex gap-1"><Button type="button" variant={mode === 'desktop' ? 'secondary' : 'ghost'} size="icon" aria-label="Vista de escritorio" aria-pressed={mode === 'desktop'} onClick={() => setMode('desktop')}><Monitor aria-hidden="true" /></Button><Button type="button" variant={mode === 'mobile' ? 'secondary' : 'ghost'} size="icon" aria-label="Vista de celular" aria-pressed={mode === 'mobile'} onClick={() => setMode('mobile')}><Smartphone aria-hidden="true" /></Button></div></div>{(activeTab === 'popups' || activeTab === 'post') && <div className="landing-preview-actions">{activeTab === 'popups' && <Button type="button" variant="outline" onClick={() => document.querySelector('.popup-journey')?.scrollIntoView({ block: 'start' })}><MapIcon aria-hidden="true" />Mapa de modales</Button>}<Button type="button" variant="outline" onClick={() => setPreviewRevision(value => value + 1)}><RotateCcw aria-hidden="true" />Reiniciar recorrido</Button></div>}<div className="border-b p-3"><Field label="Página de la vista previa">{ids => <NativeSelect {...ids} value={previewTarget} onChange={event => { const target = event.target.value; setPreviewTarget(target); setPostState('offer'); setActiveTab(target.startsWith('popup') ? 'popups' : target === 'checkout' ? 'checkout' : target === 'landing' ? 'landing' : activeTab === 'popups' ? 'popups' : 'post'); }}><option value="landing">Landing principal</option><option value="checkout">Checkout</option><option value="post">Post-compra · oferta inicial</option>{Object.entries(POPUP_PREVIEW_TARGETS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="post-downsell">Post-compra · una oportunidad más</option><option value="post-final">Post-compra · última oportunidad</option></NativeSelect>}</Field>{previewTarget.startsWith('post') && <Field className="mt-3" label="Estado de post-compra">{ids => <NativeSelect {...ids} value={postState} onChange={event => setPostState(event.target.value)}>{Object.entries(PURCHASE_PREVIEW_STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>}{previewTarget.startsWith('post') && <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-medium"><Switch aria-label="Mostrar la oferta como modal" checked={postAsModal} onCheckedChange={setPostAsModal} />Ver como modal</label>}{previewTarget === 'checkout' && <Field className="mt-3" label="Estado del checkout">{ids => <NativeSelect {...ids} value={checkoutState} onChange={event => setCheckoutState(event.target.value)}>{Object.entries({ ready: 'Formulario listo', loadingSecure: 'Carga inicial', loading: 'Cargando medios', processing: 'Procesando pago', unavailable: 'Pagos deshabilitados', error: 'Error de confirmación', loadError: 'Error de carga', methodError: 'Error del medio', sessionError: 'Error al iniciar', changedError: 'Precio actualizado', emailError: 'Falta email', nameError: 'Falta nombre', exit: 'Popup al salir' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>}</div>{preview ? <LandingFrame previewRevision={previewRevision} view={preview} mode={mode} target={previewTarget} checkoutState={checkoutState} postState={postState} onPostStageChange={stage => setPreviewTarget({ offer: 'post', downsell: 'post-downsell', final: 'post-final' }[stage])} postAsModal={postAsModal} onSelectSection={openSection} /> : <p className="p-6 text-sm">Elegí un producto principal para ver la landing.</p>}</aside>
        )}
      </div>
    </Tabs.Content>)}
  </Tabs.Root>;
}

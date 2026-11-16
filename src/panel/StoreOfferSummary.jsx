import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Gift, Sparkles, Tag } from 'lucide-react';
import { formatMoney } from '@/lib/format.js';
import { storePath } from '@/lib/panel-routes.js';
import { plainText } from '../../shared/classic-design.js';

// All commercial data comes from the store, including when displayed in the landing editor.
export default function StoreOfferSummary({ store, products, openInNewTab = false }) {
  const base = storePath(store._id);
  const linkProps = openInNewTab ? { target: '_blank', rel: 'noreferrer' } : {};
  const name = id => products.find(product => product._id === id)?.name || 'Producto no disponible';
  const sections = [
    { title: 'Producto principal', path: 'productos', icon: BookOpen, items: [{ productId: store.offer.mainProductId, price: store.offer.price }] },
    { title: 'Bonos gratis', path: 'productos#bonos', icon: Gift, items: store.offer.bonuses, free: true, empty: 'Sin bonos incluidos.' },
    { title: 'Upsells en checkout', path: 'productos#upsells', icon: Tag, items: [...store.offer.upsells].sort((a, b) => a.displayOrder - b.displayOrder), empty: 'Sin extras opcionales.' },
    { title: 'Oferta post-compra', path: 'post-compra', icon: Sparkles, items: store.postPurchase.enabled ? [store.postPurchase] : [], empty: 'Oferta desactivada.' },
  ];
  return <section className="dashboard-card p-5 sm:p-7" aria-label="Oferta asociada a esta tienda">
    <h2 className="text-lg font-semibold">Oferta de esta tienda</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">La landing presenta el producto y los bonos. El checkout usa estos precios y permite sumar upsells; la oferta post-compra aparece después del pago.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{sections.map(({ title, path, icon: Icon, items, free, empty }) => <div key={path} className="min-w-0 rounded-xl border p-4">
      <Link {...linkProps} to={`${base}/${path}`} className="flex min-h-10 items-center gap-2 text-sm font-semibold hover:text-primary"><Icon className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="flex-1">{title}</span><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /></Link>
      {items.length ? <ul className="mt-2 divide-y">{items.map(item => <li key={item.productId} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"><Link {...linkProps} className="min-w-0 break-words underline decoration-border underline-offset-4 hover:text-primary" to={`${base}/catalogo/${item.productId}`}>{name(item.productId)}</Link><span className="shrink-0 font-medium">{free ? 'Gratis' : formatMoney(item.price, store.currency)}</span></li>)}</ul> : <p className="py-3 text-sm text-muted-foreground">{empty}</p>}
    </div>)}</div>
    <p className="mt-4 text-xs leading-6 text-muted-foreground">Los cambios en productos, bonos y precios se aplican a esta oferta sin volver a publicar la landing. Las compras anteriores conservan sus importes.</p>
  </section>;
}

export function LandingContentSummary({ landing, storeId }) {
  const content = landing?.draft;
  const count = (items, singular, plural) => `${items?.length || 0} ${items?.length === 1 ? singular : plural}`;
  const sections = [
    ['hero', 'Presentación', plainText(content?.hero.title) || 'Sin título principal'],
    ['benefits', 'Beneficios', count(content?.benefits.items, 'beneficio', 'beneficios')],
    ['painPoints', 'Puntos de dolor', count(content?.painPoints?.items, 'punto de dolor', 'puntos de dolor')],
    ['socialProof', 'Testimonios', count(content?.socialProof?.items, 'testimonio', 'testimonios')],
    ['steps', 'Cómo se aplica', count(content?.steps?.items, 'paso', 'pasos')],
    ['faq', 'Preguntas frecuentes', count(content?.faq?.items, 'pregunta', 'preguntas')],
    ['guarantee', 'Garantía', content?.guarantee?.text ? (content.guarantee.enabled === false ? 'Oculta' : 'Configurada') : 'Sin configurar'],
    ['postPurchase', 'Presentación post-compra', content?.postPurchase?.title || 'Usa el nombre del producto'],
    ['postPurchaseBenefits', 'Beneficios post-compra', count(content?.postPurchaseBenefits?.items, 'beneficio', 'beneficios')],
    ['postPurchaseVideo', 'Video VSL post-compra', content?.postPurchaseVideo?.enabled && content.postPurchaseVideo.url ? 'Activado' : 'Desactivado'],
    ['promotion', 'Promoción', content?.promotion?.enabled ? 'Activada' : 'Desactivada'],
  ];
  return <section className="dashboard-card p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Contenido de la landing</h2><Link className="text-sm text-primary underline underline-offset-4" to={`${storePath(storeId)}/landing`}>Editar landing</Link></div>
    <p className="mt-2 text-sm text-muted-foreground">Resumen del borrador · {landing?.published ? 'con una versión publicada' : 'todavía sin publicar'}</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{sections.map(([id, title, detail]) => <Link key={id} to={`${storePath(storeId)}/landing#${id}`} className="rounded-xl border p-4 transition-colors hover:bg-accent"><p className="text-xs font-semibold text-muted-foreground">{title}</p><p className="mt-2 text-sm leading-6 break-words">{detail}</p></Link>)}</div>
  </section>;
}

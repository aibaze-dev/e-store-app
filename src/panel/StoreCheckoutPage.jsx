import CheckoutSettings from './CheckoutSettings.jsx';
import { ACTIVITY_DEFAULTS } from '../../shared/landing-copy.js';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api.js';
import { landingUrls } from '@/lib/site.js';
import { EmptyState, PageSkeleton } from '@/components/Field.jsx';
import { ShareLink } from './StoreDashboardPage.jsx';
import StoreOfferSummary from './StoreOfferSummary.jsx';


export default function StoreCheckoutPage() {
  const { storeId } = useParams();
  const store = useQuery(api.stores.get, { id: storeId });
  const landings = useQuery(api.landings.list, { storeId });
  const landing=landings?.find(l=>l.published || l.publicationId) ?? landings?.[0];
  const products = useQuery(api.products.list, {});
  if (store === undefined || landings === undefined || products === undefined) return <PageSkeleton label="Cargando checkout" />;
  if (!store) return <EmptyState title="Esta tienda ya no está disponible" />;
  const available = store.status === 'active' && Boolean(landing?.published || landing?.publicationId);
  const url = landing?.subdomain ? `${landingUrls(landing.subdomain).path}/checkout` : '';
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight">Checkout</h1><p className="text-sm leading-7 text-muted-foreground">El checkout de {store.name}. Incluye el producto principal y los bonos gratis; cada comprador elige sus extras.</p></div>
    <section className="dashboard-card space-y-4 p-5 sm:p-7"><ShareLink key={url} label="Checkout" url={url} icon={ShoppingCart} enabled={available} />{!available && <p className="text-sm text-muted-foreground">Activá la tienda y <Link to={`/panel/tiendas/${storeId}/landings`} className="underline underline-offset-4">publicá una landing</Link> para habilitar el checkout.</p>}</section>
    <Link to={`/panel/tiendas/${storeId}/landing#checkout`} className="block rounded-xl border bg-card p-5 text-sm font-medium text-primary underline underline-offset-4">Editar los textos en la pestaña Checkout</Link>
    <CheckoutSettings key={store._id} store={store} products={products} landingNotifications={landing?.published?.activity?.notifications ?? ACTIVITY_DEFAULTS.notifications} />
    <StoreOfferSummary store={store} products={products} />
    <p className="text-sm leading-7 text-muted-foreground">El total se calcula con el producto principal y los extras elegidos. La oferta post-compra es opcional y se cobra en un segundo pago. Después de pagar, el comprador recibe sus links en pantalla.</p>
  </div>;
}

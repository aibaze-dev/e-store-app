import { discountedPrice as discounted, mainDiscountPrices } from '../../shared/post-purchase.js';
import { fail } from './validation';

type Deliverable = { title: string; url: string };
type Product = { _id: string; name: string; status: string; deliverables: Deliverable[] };
type Store = {
  offer: {
    mainProductId: string;
    price: number;
    bonuses: { productId: string }[];
    upsells: { productId: string; price: number; displayOrder: number }[];
  };
  postPurchase: { enabled: boolean; productId?: string; price: number; downsellPercent?: number };
  downsell?: { enabled: boolean; percent: number };
};
type Role = 'main' | 'bonus' | 'upsell' | 'post_purchase';
type Item = { productId: any; name: string; role: Role; price: number };
type Delivery = { productName: string; title: string; url: string };

function snapshot(entries: { productId: string; role: Role; price: number }[], products: Map<string, Product>) {
  const items: Item[] = [];
  const deliveries: Delivery[] = [];
  for (const entry of entries) {
    const product = products.get(entry.productId);
    if (!product) fail('La oferta incluye un producto que ya no existe.');
    items.push({ productId: product._id, name: product.name, role: entry.role, price: entry.price });
    for (const link of product.deliverables) {
      deliveries.push({ productName: product.name, title: link.title, url: link.url });
    }
  }
  return { items, deliveries, total: items.reduce((sum, item) => sum + item.price, 0) };
}

export { discounted };

// The browser only says which extras it wants; every amount comes from the store.
export function buildInitialOrder(store: Store, products: Map<string, Product>, upsellProductIds: string[]) {
  if (new Set(upsellProductIds).size !== upsellProductIds.length) fail('Hay extras repetidos en la selección.');
  const upsells = [...store.offer.upsells].sort((a, b) => a.displayOrder - b.displayOrder);
  for (const id of upsellProductIds) {
    if (!upsells.some(upsell => upsell.productId === id)) fail('Uno de los extras elegidos no pertenece a esta oferta.');
  }
  return snapshot([
    { productId: store.offer.mainProductId, role: 'main', price: store.offer.price },
    ...store.offer.bonuses.map(bonus => ({ productId: bonus.productId, role: 'bonus' as const, price: 0 })),
    ...upsells.filter(upsell => upsellProductIds.includes(upsell.productId))
      .map(upsell => ({ productId: upsell.productId, role: 'upsell' as const, price: upsell.price })),
  ], products);
}

// The main product with its bonuses, without extras, at the store's downsell discount.
export function buildDownsellOrder(store: Store, products: Map<string, Product>, final = false) {
  if (!store.downsell?.enabled) fail('Esta oferta ya no está disponible.');
  const prices = mainDiscountPrices(store.offer.price, store.downsell.percent);
  return snapshot([
    { productId: store.offer.mainProductId, role: 'main', price: final ? prices.finalPrice : prices.price },
    ...store.offer.bonuses.map(bonus => ({ productId: bonus.productId, role: 'bonus' as const, price: 0 })),
  ], products);
}

// Last chance after the buyer declined the post-purchase offer (and its downsell, when set).
export { finalPostPurchasePercent } from '../../shared/post-purchase.js';
import { finalPostPurchasePercent } from '../../shared/post-purchase.js';

export type PostPurchaseStage = 'offer' | 'downsell' | 'final';
export function buildPostPurchaseOrder(store: Store, products: Map<string, Product>, stage: PostPurchaseStage = 'offer') {
  if (!store.postPurchase.enabled || !store.postPurchase.productId) fail('Esta oferta ya no está disponible.');
  const percent = stage === 'final' ? finalPostPurchasePercent(store.postPurchase) : stage === 'downsell' ? store.postPurchase.downsellPercent ?? 0 : 0;
  if (stage === 'downsell' && !percent) fail('Esta oferta ya no está disponible.');
  return snapshot([
    { productId: store.postPurchase.productId, role: 'post_purchase', price: percent ? discounted(store.postPurchase.price, percent) : store.postPurchase.price },
  ], products);
}

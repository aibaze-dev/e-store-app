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

// Price after a downsell discount, in the currency's minor unit.
export function discounted(price: number, percent: number) {
  return Math.max(1, Math.round(price * (100 - percent) / 100));
}

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
export function buildDownsellOrder(store: Store, products: Map<string, Product>) {
  if (!store.downsell?.enabled) fail('Esta oferta ya no está disponible.');
  return snapshot([
    { productId: store.offer.mainProductId, role: 'main', price: discounted(store.offer.price, store.downsell.percent) },
    ...store.offer.bonuses.map(bonus => ({ productId: bonus.productId, role: 'bonus' as const, price: 0 })),
  ], products);
}

export function buildPostPurchaseOrder(store: Store, products: Map<string, Product>, downsell = false) {
  if (!store.postPurchase.enabled || !store.postPurchase.productId) fail('Esta oferta ya no está disponible.');
  const percent = store.postPurchase.downsellPercent ?? 0;
  if (downsell && !percent) fail('Esta oferta ya no está disponible.');
  return snapshot([
    { productId: store.postPurchase.productId, role: 'post_purchase', price: downsell ? discounted(store.postPurchase.price, percent) : store.postPurchase.price },
  ], products);
}

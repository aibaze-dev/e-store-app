import type { Doc, QueryCtx } from './functions';

type Delivery = { productName: string; title: string; url: string; kind?: 'file' | 'link'; coverUrl?: string; role?: Doc<'orders'>['items'][number]['role'] };

type Link = { title: string; url: string };
type StoreLanguage = Doc<'stores'>['language'];

export function deliveryLink(link: Link, type: string | undefined, name: string, language: StoreLanguage) {
  if (type !== 'artifact' || !language) return link;
  const url = new URL(link.url);
  url.searchParams.set('lang', language);
  return { ...link, title: name, url: url.href };
}

// Links a buyer receives for an order, read from each product as it is now, so an edited
// file or link reaches past buyers too. Names stay those of the order. A product that was
// deleted or left without deliverables keeps the links copied when the order was created.
// Each link carries its item's role, so the thank-you page can group main, bonus and extras,
// and the product cover, which the celebration shows and the main card keeps.
export async function liveDeliveries(ctx: QueryCtx, order: Doc<'orders'>, copied: Delivery[]): Promise<Delivery[]> {
  const deliveries: Delivery[] = [];
  for (const item of order.items) {
    const product = await ctx.db.get(item.productId);
    if (product && product.deliverables.length > 0) {
      for (const link of product.deliverables) {
        const localized = deliveryLink(link, product.type, item.name, order.storeLanguage);
        deliveries.push({ ...localized, productName: item.name, role: item.role, ...(product.coverUrl ? { coverUrl: product.coverUrl } : {}) });
      }
    } else {
      deliveries.push(...copied.filter(link => link.productName === item.name).map(link => ({ ...link, role: item.role })));
    }
  }
  return deliveries;
}

import type { Doc, QueryCtx } from './functions';

type Delivery = { productName: string; title: string; url: string; kind?: 'file' | 'link'; role?: Doc<'orders'>['items'][number]['role'] };

// Links a buyer receives for an order, read from each product as it is now, so an edited
// file or link reaches past buyers too. Names stay those of the order. A product that was
// deleted or left without deliverables keeps the links copied when the order was created.
// Each link carries its item's role, so the thank-you page can group main, bonus and extras.
export async function liveDeliveries(ctx: QueryCtx, order: Doc<'orders'>, copied: Delivery[]): Promise<Delivery[]> {
  const deliveries: Delivery[] = [];
  for (const item of order.items) {
    const product = await ctx.db.get(item.productId);
    if (product && product.deliverables.length > 0) {
      for (const link of product.deliverables) deliveries.push({ productName: item.name, title: link.title, url: link.url, role: item.role, ...(link.kind ? { kind: link.kind } : {}) });
    } else {
      deliveries.push(...copied.filter(link => link.productName === item.name).map(link => ({ ...link, role: item.role })));
    }
  }
  return deliveries;
}

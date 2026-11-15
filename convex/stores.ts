import { forStore } from './lib/landing_records';
import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { cleanAmount, cleanCurrency, cleanPercent, cleanText, fail } from './lib/validation';
import { storeCheckout, storeDownsell, storeOffer, storePostPurchase } from './schema';

const fields = {
  name: v.string(),
  status: v.union(v.literal('draft'), v.literal('active')),
  currency: v.string(),
  offer: storeOffer,
  postPurchase: storePostPurchase,
  downsell: v.optional(storeDownsell),
  tracking: v.object({ metaPixelId: v.string() }),
};

async function clean(ctx: MutationCtx, args: {
  name: string; status: 'draft' | 'active'; currency: string;
  offer: typeof storeOffer.type; postPurchase: typeof storePostPurchase.type; downsell?: typeof storeDownsell.type; tracking: { metaPixelId: string };
}) {
  const { offer, postPurchase, downsell } = args;
  const compareAtPrice = offer.compareAtPrice === undefined ? undefined : cleanAmount(offer.compareAtPrice, 'Precio de referencia');
  if (compareAtPrice !== undefined && compareAtPrice <= offer.price) fail('El precio de referencia debe ser mayor al precio de venta.');
  const main = await ctx.db.get(offer.mainProductId);
  if (!main) fail('Producto principal: elegí un producto del catálogo.');
  if (offer.bonuses.length > 20 || offer.upsells.length > 10) fail('Usá hasta 20 bonos y 10 extras por tienda.');

  const bonusIds = offer.bonuses.map(bonus => bonus.productId);
  const upsellIds = offer.upsells.map(upsell => upsell.productId);
  if (new Set(bonusIds).size !== bonusIds.length) fail('Bonos: hay un producto repetido.');
  if (new Set(upsellIds).size !== upsellIds.length) fail('Extras: hay un producto repetido.');
  for (const id of [...bonusIds, ...upsellIds]) {
    if (!(await ctx.db.get(id))) fail('Uno de los productos elegidos ya no existe.');
    if (id === offer.mainProductId) fail('El producto principal no puede repetirse como bono o extra.');
  }

  if (postPurchase.enabled) {
    if (!postPurchase.productId || !(await ctx.db.get(postPurchase.productId))) {
      fail('Oferta post-compra: elegí un producto del catálogo.');
    }
  }
  if (args.status === 'active' && main.deliverables.length === 0) {
    fail('Para activar la tienda, el producto principal necesita al menos un entregable.');
  }

  const pixel = args.tracking.metaPixelId.trim();
  if (pixel && !/^\d{5,20}$/.test(pixel)) fail('Meta Pixel: ingresá solo el número de ID del pixel.');

  return {
    name: cleanText(args.name, 'Nombre', 120, true),
    status: args.status,
    currency: cleanCurrency(args.currency),
    offer: {
      mainProductId: offer.mainProductId,
      price: cleanAmount(offer.price, 'Precio principal'),
      compareAtPrice,
      bonuses: offer.bonuses.map(bonus => ({ productId: bonus.productId, referenceValue: bonus.referenceValue === undefined ? undefined : cleanAmount(bonus.referenceValue, 'Valor del bono', 0) })),
      upsells: offer.upsells.map((upsell, index) => ({
        productId: upsell.productId,
        price: cleanAmount(upsell.price, `Precio del extra ${index + 1}`),
        displayOrder: index,
      })),
    },
    postPurchase: {
      enabled: postPurchase.enabled,
      productId: postPurchase.productId,
      price: postPurchase.enabled ? cleanAmount(postPurchase.price, 'Precio post-compra') : cleanAmount(postPurchase.price, 'Precio post-compra', 0),
      ...(postPurchase.downsellPercent ? { downsellPercent: cleanPercent(postPurchase.downsellPercent, 'Descuento del downsell post-compra') } : {}),
    },
    ...(downsell ? { downsell: {
      enabled: downsell.enabled,
      percent: cleanPercent(downsell.percent, 'Descuento del downsell', downsell.enabled ? 1 : 0),
      modalTitle: cleanText(downsell.modalTitle, 'Título del modal', 80),
      modalSubtitle: cleanText(downsell.modalSubtitle, 'Subtítulo del modal', 240),
      acceptText: cleanText(downsell.acceptText, 'Texto del botón principal', 40),
      declineText: cleanText(downsell.declineText, 'Texto del botón secundario', 40),
      pageTitle: cleanText(downsell.pageTitle, 'Título de la oferta', 80),
      pageSubtitle: cleanText(downsell.pageSubtitle, 'Subtítulo de la oferta', 240),
    } } : {}),
    tracking: { metaPixelId: pixel },
  };
}

export const list = query({
  args: {},
  handler: async ctx => {
    await requireAdmin(ctx);
    const stores = await ctx.db.query('stores').order('desc').collect();
    return await Promise.all(stores.map(async store => {
      const main = await ctx.db.get(store.offer.mainProductId);
      const classic = await forStore(ctx, store._id), quiz = await forStore(ctx, store._id, 'quiz');
      const landing = classic?.published ? classic : quiz?.publicationId ? quiz : classic ?? quiz;
      return {
        _id: store._id,
        name: store.name,
        status: store.status,
        currency: store.currency,
        price: store.offer.price,
        mainProductName: main?.name ?? '',
        subdomain: landing?.subdomain ?? '',
        published: Boolean(landing?.published || landing?.publicationId),
      };
    }));
  },
});

export const get = query({
  args: { id: v.id('stores') },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: fields,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert('stores', await clean(ctx, args));
  },
});

export const update = mutation({
  args: { id: v.id('stores'), ...fields },
  handler: async (ctx, { id, ...args }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) fail('La tienda ya no existe.');
    const next = await clean(ctx, args);
    // Checkout settings are edited on their own screen; keep them, minus extras that left the offer.
    const checkout = existing.checkout && {
      ...existing.checkout,
      upsellReferences: existing.checkout.upsellReferences.filter(reference => next.offer.upsells.some(upsell => upsell.productId === reference.productId)),
    };
    // A caller that does not send the downsell leaves the saved one as it is.
    const downsell = next.downsell ?? existing.downsell;
    await ctx.db.replace(id, { ...next, ...(downsell ? { downsell } : {}), ...(checkout ? { checkout } : {}) });
    return id;
  },
});

export const updateCheckout = mutation({
  args: { id: v.id('stores'), checkout: storeCheckout },
  handler: async (ctx, { id, checkout }) => {
    await requireAdmin(ctx);
    const store = await ctx.db.get(id);
    if (!store) fail('La tienda ya no existe.');
    const seen = new Set<string>();
    const upsellReferences = checkout.upsellReferences.map(reference => {
      const upsell = store.offer.upsells.find(item => item.productId === reference.productId);
      if (!upsell || seen.has(reference.productId)) fail('Precio de referencia: elegí un extra de esta tienda, una sola vez.');
      seen.add(reference.productId);
      const value = cleanAmount(reference.value, 'Precio de referencia');
      if (value <= upsell.price) fail('El precio de referencia de un extra debe ser mayor a su precio de venta.');
      return { productId: reference.productId, value };
    });
    await ctx.db.patch(id, { checkout: { notifications: checkout.notifications, liveVisitors: checkout.liveVisitors ?? false, upsellTitle: cleanText(checkout.upsellTitle, 'Título de los extras', 60), upsellReferences } });
    return id;
  },
});

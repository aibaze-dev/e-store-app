import { storeProductName } from '../../shared/artifact-registry.js';
import { mainDiscountPrices } from '../../shared/post-purchase.js';
import type { Doc, QueryCtx } from './functions';
import { discounted, finalPostPurchasePercent } from './pricing';
import { ACTIVITY_DEFAULTS } from '../../shared/landing-copy.js';
import { pixelIds } from '../../shared/pixels.js';
import { postPurchaseContent } from '../../shared/post-purchase.js';

type Content = NonNullable<Doc<'landings'>['published']>;

// Shared by authenticated previews and the paid delivery response. No deliverable URLs.
export async function buildPostPurchaseView(ctx: QueryCtx, store: Doc<'stores'>, content?: Content) {
  const config = store.postPurchase;
  if (!config.enabled || !config.productId) return null;
  const product = await ctx.db.get(config.productId);
  if (!product) return null;
  return {
    name: storeProductName(product, store.language), description: product.description, coverUrl: product.coverUrl, price: config.price,
    content: { ...postPurchaseContent(content), postLabels: content?.postLabels ?? {}, postOptions: content?.postOptions ?? {}, popupOptions: content?.popupOptions ?? {}, checkout: content?.checkout ?? {} },
    ...(config.downsellPercent ? { downsellPercent: config.downsellPercent, downsellPrice: discounted(config.price, config.downsellPercent) } : {}),
    finalPercent: finalPostPurchasePercent(config), finalPrice: discounted(config.price, finalPostPurchasePercent(config)),
  };
}

// Only the first name of a real buyer is ever public; an email typed as a name is dropped.
function firstName(name: string | undefined) {
  const first = (name ?? '').trim().split(/\s+/)[0].slice(0, 24);
  return first.includes('@') ? '' : first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// Sales shown on the landing come from paid orders of this store, never from typed values.
async function buildActivity(ctx: QueryCtx, store: Doc<'stores'>, show: { recent: boolean; sales: boolean }) {
  if (!show.recent && !show.sales) return null;
  const paid = (await ctx.db.query('orders').withIndex('by_store', q => q.eq('storeId', store._id)).order('desc').collect())
    .filter(order => order.status === 'paid' && !order.parentOrderId);
  return {
    sales: show.sales ? paid.length : 0,
    recent: show.recent ? paid.slice(0, 8).map(order => ({ name: firstName(order.buyer?.name), at: order._creationTime })) : [],
  };
}

// Public shape of a landing. It never includes deliverables.
export async function buildLandingView(ctx: QueryCtx, store: Doc<'stores'>, landing: Doc<'landings'>, content: Content) {
  const card = async (productId: Doc<'products'>['_id'], price?: number, legacyReference?: number) => {
    const product = await ctx.db.get(productId);
    if (!product) return null;
    // Absent means a legacy product; null explicitly removes its reference price.
    const reference = product.referencePrice === undefined ? legacyReference
      : product.referencePrice?.currency.toUpperCase() === store.currency.toUpperCase() ? product.referencePrice.value : undefined;
    return { productId: product._id, name: storeProductName(product, store.language), description: product.description, coverUrl: product.coverUrl,
      shortDescription: product.shortDescription ?? '', featured: product.featured ?? false,
      ...(price !== undefined && reference !== undefined && reference > price ? { compareAtPrice: reference } : {}) };
  };
  const main = await card(store.offer.mainProductId, store.offer.price, store.offer.compareAtPrice);
  if (!main) return null;
  const bonuses = (await Promise.all(store.offer.bonuses.map(async bonus => {
    const product = await card(bonus.productId);
    return product && { ...product, referenceValue: bonus.referenceValue };
  }))).filter(item => item !== null);
  const references = new Map((store.checkout?.upsellReferences ?? []).map(reference => [reference.productId, reference.value]));
  const upsells = (await Promise.all([...store.offer.upsells]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(async upsell => {
      const product = await card(upsell.productId, upsell.price, references.get(upsell.productId));
      return product && { ...product, price: upsell.price };
    }))).filter(item => item !== null);

  return {
    subdomain: landing.subdomain,
    template: landing.template,
    content,
    store: { id: store._id, name: store.name, currency: store.currency, ...(store.language ? { language: store.language } : {}), metaPixelIds: pixelIds(store.tracking) },
    offer: { main: { ...main, price: store.offer.price }, bonuses, upsells },
    downsell: store.downsell?.enabled ? { ...store.downsell, ...mainDiscountPrices(store.offer.price, store.downsell.percent) } : null,
    checkout: { upsellTitle: store.checkout?.upsellTitle ?? '', notifications: store.checkout?.notifications ?? content.activity?.notifications ?? ACTIVITY_DEFAULTS.notifications, liveVisitors: store.checkout?.liveVisitors ?? false },
    activity: await buildActivity(ctx, store, {
      recent: Boolean((content.activity?.notifications ?? ACTIVITY_DEFAULTS.notifications) || store.checkout?.notifications),
      sales: content.activity?.salesCount ?? ACTIVITY_DEFAULTS.salesCount,
    }),
  };
}

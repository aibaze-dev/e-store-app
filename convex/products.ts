import { v } from 'convex/values';
import { mutation, query } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { cleanText, cleanUrl, cleanAmount, cleanCurrency, fail } from './lib/validation';
import { deliverable } from './schema';

const fields = {
  name: v.string(),
  shortDescription: v.optional(v.string()),
  featured: v.optional(v.boolean()),
  referencePrice: v.optional(v.union(v.null(), v.object({ currency: v.string(), value: v.number() }))),
  description: v.string(),
  coverUrl: v.string(),
  status: v.union(v.literal('active'), v.literal('archived')),
  deliverables: v.array(deliverable),
};

function clean(args: { name: string; shortDescription?: string; featured?: boolean; referencePrice?: { currency: string; value: number } | null; description: string; coverUrl: string; status: 'active' | 'archived'; deliverables: { title: string; url: string }[] }) {
  if (args.deliverables.length > 30) fail('Entregables: usá hasta 30 archivos por producto.');
  return {
    type: 'e-book' as const,
    ...(args.shortDescription !== undefined ? { shortDescription: cleanText(args.shortDescription, 'Descripción corta', 180) } : {}),
    ...(args.featured !== undefined ? { featured: args.featured } : {}),
    ...(args.referencePrice !== undefined ? { referencePrice: args.referencePrice === null ? null : { currency: cleanCurrency(args.referencePrice.currency), value: cleanAmount(args.referencePrice.value, 'Precio de referencia') } } : {}),
    name: cleanText(args.name, 'Nombre', 120, true),
    description: cleanText(args.description, 'Descripción', 2000),
    coverUrl: cleanUrl(args.coverUrl, 'Portada'),
    status: args.status,
    deliverables: args.deliverables.map((link, index) => ({
      title: cleanText(link.title, `Entregable ${index + 1}`, 120, true),
      url: cleanUrl(link.url, `Entregable ${index + 1}`, true),
    })),
  };
}

export const list = query({
  args: {},
  handler: async ctx => {
    await requireAdmin(ctx);
    return await ctx.db.query('products').order('desc').collect();
  },
});

export const get = query({
  args: { id: v.id('products') },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: fields,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert('products', clean(args));
  },
});

export const update = mutation({
  args: { id: v.id('products'), ...fields },
  handler: async (ctx, { id, ...args }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) fail('El producto ya no existe.');
    // Older clients omit the new presentation fields; keep the saved product settings.
    await ctx.db.patch(id, clean(args));
    return id;
  },
});

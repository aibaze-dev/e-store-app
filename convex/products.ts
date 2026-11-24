import { v } from 'convex/values';
import { mutation, query } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { cleanText, cleanUrl, cleanAmount, cleanCurrency, fail } from './lib/validation';
import { deliverable } from './schema';
import { artifacts } from '../shared/artifact-registry.js';

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

// Types the catalogue form can save. Artifacts have their own mutation below.
const editableType = v.optional(v.union(v.literal('e-book'), v.literal('app')));
type EditableType = 'e-book' | 'app';

function clean(args: { name: string; shortDescription?: string; featured?: boolean; referencePrice?: { currency: string; value: number } | null; description: string; coverUrl: string; status: 'active' | 'archived'; deliverables: { title: string; url: string; kind?: 'file' | 'link' }[] }, type: EditableType = 'e-book') {
  if (args.deliverables.length > 30) fail('Entregables: usá hasta 30 documentos o enlaces por producto.');
  // An app delivers exactly one thing: the link to it, named after the product.
  if (type === 'app') {
    if (args.deliverables.length !== 1 || args.deliverables[0].kind !== 'link') fail('App: ingresá el link de la app.');
    args = { ...args, deliverables: [{ title: args.name, url: cleanUrl(args.deliverables[0].url, 'Link de la app', true), kind: 'link' }] };
  }
  return {
    type,
    ...(args.shortDescription !== undefined ? { shortDescription: cleanText(args.shortDescription, 'Descripción corta', 180) } : {}),
    ...(args.featured !== undefined ? { featured: args.featured } : {}),
    ...(args.referencePrice !== undefined ? { referencePrice: args.referencePrice === null ? null : { currency: cleanCurrency(args.referencePrice.currency), value: cleanAmount(args.referencePrice.value, 'Precio de referencia') } } : {}),
    name: cleanText(args.name, 'Nombre', 120, true),
    description: cleanText(args.description, 'Descripción', 2000),
    coverUrl: cleanUrl(args.coverUrl, 'Portada'),
    status: args.status,
    deliverables: args.deliverables.map((link, index) => ({
      ...(link.kind !== undefined ? { kind: link.kind } : {}),
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
  args: { ...fields, type: editableType },
  handler: async (ctx, { type, ...args }) => {
    await requireAdmin(ctx);
    return await ctx.db.insert('products', clean(args, type));
  },
});

export const update = mutation({
  args: { id: v.id('products'), ...fields, type: editableType },
  handler: async (ctx, { id, type, ...args }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) fail('El producto ya no existe.');
    if (existing.type === 'artifact') fail('Editá este recurso desde el catálogo de Artefactos.');
    // Older clients omit the new presentation fields; keep the saved product settings.
    // A client that does not send the type keeps the saved one.
    await ctx.db.patch(id, clean(args, type ?? (existing.type === 'app' ? 'app' : 'e-book')));
    return id;
  },
});


export const getByArtifactSlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireAdmin(ctx);
    return await ctx.db.query('products').withIndex('by_artifact_slug', q => q.eq('artifactSlug', slug)).unique();
  },
});

// The code registry owns identity and execution; the product owns its commercial presentation.
const { deliverables: _deliverables, ...presentationFields } = fields;
export const saveArtifact = mutation({
  args: { slug: v.string(), ...presentationFields },
  handler: async (ctx, { slug, ...args }) => {
    await requireAdmin(ctx);
    if (!artifacts.some(artifact => artifact.slug === slug)) fail('El artefacto no está registrado.');
    let origin: string;
    try {
      const site = new URL(process.env.SITE_URL ?? '');
      if (!['https:', 'http:'].includes(site.protocol)) throw new Error();
      origin = site.origin;
    } catch { return fail('Configurá SITE_URL con el dominio principal antes de guardar artefactos.'); }
    const data = {
      ...clean({ ...args, deliverables: [{ title: args.name, url: `${origin}/a/${encodeURIComponent(slug)}`, kind: 'link' }] }),
      type: 'artifact' as const,
      artifactSlug: slug,
    };
    const existing = await ctx.db.query('products').withIndex('by_artifact_slug', q => q.eq('artifactSlug', slug)).unique();
    if (existing) { await ctx.db.patch(existing._id, data); return existing._id; }
    return await ctx.db.insert('products', data);
  },
});

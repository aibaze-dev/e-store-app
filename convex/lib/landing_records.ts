import type { QueryCtx, MutationCtx, Id, Doc } from './functions';
import { cleanSubdomain, fail } from './validation';
import { EMPTY_CONTENT } from '../../src/templates/content.js';
export const landingType = (row: Doc<'landings'>) => row.template === 'quiz' ? 'quiz' : 'classic';
export async function forStore(ctx: QueryCtx, storeId: Id<'stores'>, type = 'classic') {
  return (await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).collect()).find(row => landingType(row) === type) ?? null;
}
export async function publicStore(ctx: QueryCtx, subdomain: string) {
  const address = subdomain.toLowerCase();
  const store = await ctx.db.query('stores').withIndex('by_subdomain', q => q.eq('subdomain', address)).first();
  if (store) return store;
  const legacy = await ctx.db.query('landings').withIndex('by_subdomain', q => q.eq('subdomain', address)).first();
  const fallback = legacy && await ctx.db.get(legacy.storeId);
  return fallback && (!fallback.subdomain || fallback.subdomain === address) ? fallback : null;
}
export async function checkoutRecord(ctx: QueryCtx, subdomain: string) {
  const store = await publicStore(ctx, subdomain);
  if (!store || store.status !== 'active') return null;
  const rows = await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', store._id)).collect();
  const landing = rows.find(row => row.template !== 'quiz' && row.published) ?? rows.find(row => row.template === 'quiz' && row.publicationId);
  return landing ? { store, landing } : null;
}
export async function purchaseContent(ctx: QueryCtx, store: Doc<'stores'>, draft = false) {
  const saved = draft ? store.purchaseDraft : store.purchasePublished;
  const classic = saved ? null : await forStore(ctx, store._id);
  return saved ?? (draft ? classic?.draft : classic?.published) ?? { ...EMPTY_CONTENT, promotion: { ...EMPTY_CONTENT.promotion, enabled: false }, guarantee: { ...EMPTY_CONTENT.guarantee, enabled: false } };
}
export async function setAddress(ctx: MutationCtx, storeId: Id<'stores'>, address: string) {
  const subdomain = cleanSubdomain(address);
  const taken = await publicStore(ctx, subdomain);
  if (taken && taken._id !== storeId) fail('Subdominio: ya lo usa otra tienda.');
  await ctx.db.patch(storeId, { subdomain });
  for (const row of await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).collect()) await ctx.db.patch(row._id, { subdomain });
  return subdomain;
}

// The address is edited only from the store settings (`stores.setSubdomain`). Landing and quiz saves reuse it:
// a different value is rejected, and only a store that still has no address may be given one here.
export async function resolveAddress(ctx: MutationCtx, storeId: Id<'stores'>, requested?: string) {
  const store = await ctx.db.get(storeId);
  if (!store) fail('Tienda no disponible.');
  const current = store.subdomain ?? (await forStore(ctx, storeId))?.subdomain ?? (await forStore(ctx, storeId, 'quiz'))?.subdomain;
  if (!current) {
    if (!requested?.trim()) fail('Definí el subdominio en Configuración antes de guardar.');
    return await setAddress(ctx, storeId, requested);
  }
  if (requested !== undefined && requested.trim() && cleanSubdomain(requested) !== current) fail('El subdominio solo se puede cambiar desde Configuración.');
  return current;
}

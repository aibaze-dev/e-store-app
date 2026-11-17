import { v } from 'convex/values';
import { mutation } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { fail } from './lib/validation';
import { mediaError } from '../shared/media.js';

export const uploadUrl = mutation({ args: {}, handler: async ctx => {
  await requireAdmin(ctx);
  return ctx.storage.generateUploadUrl();
} });

export const finalize = mutation({
  args: { storageId: v.id('_storage'), kind: v.union(v.literal('image'), v.literal('video'), v.literal('file')) },
  handler: async (ctx, { storageId, kind }) => {
    await requireAdmin(ctx);
    const file = await ctx.db.system.get(storageId);
    if (!file) fail('No se encontró el archivo subido.');
    const error = mediaError(kind, file!);
    if (error) {
      await ctx.storage.delete(storageId);
      // Return errors so deleting a rejected upload is committed.
      return { error };
    }
    const url = await ctx.storage.getUrl(storageId);
    if (!url) fail('No se pudo obtener el archivo subido.');
    return { url };
  },
});

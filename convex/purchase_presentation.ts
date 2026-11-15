import { v } from 'convex/values';
import { mutation, query } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { forStore, purchaseContent } from './lib/landing_records';
import { cleanContent } from './landings';
import { landingContent } from './schema';
import { fail } from './lib/validation';
const keys=['postPurchase','postPurchaseBenefits','postPurchaseVideo','guarantee','promotion','footer','activity','style'] as const;
export const get=query({args:{storeId:v.id('stores')},handler:async(ctx,{storeId})=>{await requireAdmin(ctx);const store=await ctx.db.get(storeId);if(!store)return null;return {draft:await purchaseContent(ctx,store,true),published:store.purchasePublished??null};}});
export const save=mutation({args:{storeId:v.id('stores'),draft:landingContent,publish:v.boolean()},handler:async(ctx,{storeId,draft,publish})=>{
 await requireAdmin(ctx);const store=await ctx.db.get(storeId);if(!store)fail('Tienda no disponible.');const content=cleanContent(draft);
 await ctx.db.patch(storeId,{purchaseDraft:content,...(publish?{purchasePublished:content}:{})});
 // Keep legacy editor inputs in sync; its routes and draft workflow remain supported.
 const classic=await forStore(ctx,storeId);if(classic){const next={...classic.draft};for(const key of keys)(next as any)[key]=content[key];await ctx.db.patch(classic._id,{draft:next});}
}});

import { makeFunctionReference } from 'convex/server';
import { hashIp, normalizeIp, requestIp } from './lib/analytics_ip';
import { saveQuizDraft, publishQuiz } from './lib/quiz_records';
import { v } from 'convex/values';
import { action, internalQuery, mutation, query, type QueryCtx, type Id } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { forStore, publicStore, purchaseContent } from './lib/landing_records';
import { buildLandingView } from './lib/landing_view';
import { fail } from './lib/validation';
import { assertQuiz, createQuizTemplate, initialSession, advanceSession, moveSession } from '../shared/quiz.js';
import { cleanAttribution } from '../shared/attribution.js';
import { storeProductName } from '../shared/artifact-registry.js';
import { attribution as attributionArg } from './schema';

export async function tokenHash(token: string) {
 if(!/^[a-zA-Z0-9-]{64,128}$/.test(token)) fail('Invalid session token.');
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
 return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function authorizedSession(ctx: QueryCtx, token: string) {
 const hash=await tokenHash(token);
 const session=await ctx.db.query('quizSessions').withIndex('by_token',q=>q.eq('tokenHash',hash)).unique();
 if(!session) fail('Quiz session not found.');
 const landing=await ctx.db.get(session.landingId),store=await ctx.db.get(session.storeId);
 if(!landing?.publicationId || store?.status!=='active') fail('This quiz is not published.');
 return session;
}
async function response(ctx: QueryCtx, session: any) {
 const publication=await ctx.db.get(session.publicationId);
 return {quiz:publication!.content,session:{revision:session.revision,lastCommand:session.lastCommand,currentStep:session.currentStep,history:session.history,answers:session.answers,calculations:session.calculations,...(session.resultId?{resultId:session.resultId}:{}),...(session.completedAt?{completedAt:session.completedAt}:{})}};
}
export const get = query({args:{storeId:v.id('stores')},handler:async(ctx,{storeId})=>{
 await requireAdmin(ctx); const store=await ctx.db.get(storeId); if(!store)return null;
 const landing=await forStore(ctx,storeId,'quiz'); const product=await ctx.db.get(store.offer.mainProductId);
 return {landing,quiz:landing?.quizDraft ?? createQuizTemplate(storeProductName(product,store.language)),subdomain:store.subdomain ?? (await forStore(ctx,storeId))?.subdomain ?? '',view:await buildLandingView(ctx,store,landing ?? {_id:'',storeId,subdomain:'',template:'quiz'} as any,await purchaseContent(ctx,store,true))};
}});
// Starting a quiz from another store: lists the other stores with a published quiz, and hands
// back a copy of one adapted to this store. The copy is only a proposal; the editor saves it
// as a draft through `save`, so nothing changes until the admin accepts it.
export const cloneSources = query({args:{storeId:v.id('stores')},handler:async(ctx,{storeId})=>{
 await requireAdmin(ctx);
 const sources:{storeId:Id<'stores'>,name:string,subdomain:string,publishedAt:number,steps:number}[]=[];
 for(const landing of await ctx.db.query('landings').collect()){
  if(landing.storeId===storeId||!landing.publicationId||landing.template!=='quiz')continue;
  const store=await ctx.db.get(landing.storeId),publication=await ctx.db.get(landing.publicationId);
  if(!store||!publication)continue;
  sources.push({storeId:store._id,name:store.name,subdomain:store.subdomain ?? landing.subdomain,publishedAt:landing.publishedAt ?? publication._creationTime,steps:Array.isArray(publication.content?.steps)?publication.content.steps.length:0});
 }
 return sources.sort((a,b)=>b.publishedAt-a.publishedAt);
}});
export const cloneProposal = query({args:{storeId:v.id('stores'),sourceStoreId:v.id('stores')},handler:async(ctx,{storeId,sourceStoreId})=>{
 await requireAdmin(ctx);
 if(storeId===sourceStoreId)fail('Elegí otra tienda.');
 const store=await ctx.db.get(storeId);if(!store)fail('Tienda no disponible.');
 const source=await forStore(ctx,sourceStoreId,'quiz');
 const publication=source?.publicationId?await ctx.db.get(source.publicationId):null;
 if(!publication)fail('Esa tienda no tiene un quiz publicado.');
 // Name and logo belong to this store's brand; colors, texts and navigation come from the copy.
 const current=await forStore(ctx,storeId,'quiz'),product=await ctx.db.get(store.offer.mainProductId);
 const own=(current?.quizDraft ?? createQuizTemplate(storeProductName(product,store.language))).identity ?? {};
 const quiz=structuredClone(publication.content);
 quiz.identity={...quiz.identity,name:own.name ?? quiz.identity?.name,logoUrl:own.logoUrl ?? ''};
 return assertQuiz(quiz);
}});
export const save = mutation({args:{storeId:v.id('stores'),subdomain:v.optional(v.string()),quiz:v.any()},handler:async(ctx,args)=>{
 await requireAdmin(ctx);return saveQuizDraft(ctx,args.storeId,args.subdomain,args.quiz);
}});
// Step images: the browser uploads straight to Convex storage and the quiz keeps the served
// HTTPS URL. Only raster images up to 5 MB; anything else is deleted right away. Rejections
// are returned, not thrown: throwing would roll back the deletion with the transaction.
const IMAGE_TYPES=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
export const imageUploadUrl = mutation({args:{},handler:async ctx=>{await requireAdmin(ctx);return ctx.storage.generateUploadUrl();}});
export const imageUrl = mutation({args:{storageId:v.id('_storage')},handler:async(ctx,{storageId})=>{
 await requireAdmin(ctx);const file=await ctx.db.system.get(storageId);
 if(!file)fail('No se encontró la imagen subida.');
 if(!IMAGE_TYPES.includes(file.contentType??'')||file.size>5*1024*1024){await ctx.storage.delete(storageId);return {error:'Subí una imagen JPG, PNG, WebP, GIF o AVIF de hasta 5 MB.'};}
 const url=await ctx.storage.getUrl(storageId);if(!url)fail('No se pudo obtener la imagen.');return {url};
}});
export const publish = mutation({args:{storeId:v.id('stores')},handler:async(ctx,{storeId})=>{
 await requireAdmin(ctx);return publishQuiz(ctx,storeId);
}});
export const publicConfig = query({args:{subdomain:v.string()},handler:async(ctx,{subdomain})=>{
 const store=await publicStore(ctx,subdomain);if(!store || store.status!=='active')return null;
 const landing=await forStore(ctx,store._id,'quiz');if(!landing?.publicationId)return null;
 return (await ctx.db.get(landing.publicationId))!.content;
}});
export const start = mutation({args:{subdomain:v.string(),token:v.string(),attribution:v.optional(attributionArg)},handler:async(ctx,{subdomain,token,attribution})=>{
 const hash=await tokenHash(token);const store=await publicStore(ctx,subdomain);
 if(!store || store.status!=='active')fail('This quiz is not available.');
 const landing=await forStore(ctx,store._id,'quiz');if(!landing?.publicationId)fail('This quiz is not published.');
 const existing=await ctx.db.query('quizSessions').withIndex('by_token',q=>q.eq('tokenHash',hash)).unique();
 if(existing){if(existing.storeId!==store._id)fail('This session belongs to another store.');
  // Published again since this visitor started: they continue on the current version.
  if(existing.publicationId!==landing.publicationId){const current=(await ctx.db.get(landing.publicationId))!;
   await ctx.db.patch(existing._id,{publicationId:current._id,...moveSession(current.content,existing),updatedAt:Date.now()});
   return response(ctx,await ctx.db.get(existing._id));}
  return response(ctx,existing);}
 const secret=process.env.ANALYTICS_IP_SECRET||process.env.BETTER_AUTH_SECRET;
 const ip=secret?normalizeIp(await requestIp(ctx)):null;
 const ipHash=secret?await hashIp(ip,`quiz:${store._id}`,secret):undefined;
 const recent=await ctx.db.query('quizSessions').withIndex('by_store_ip',q=>q.eq('storeId',store._id).eq('ipHash',ipHash).gte('_creationTime',Date.now()-60000)).take(120);
 if(recent.length>=120)fail('Too many attempts. Please wait a minute and try again.');
 const publication=(await ctx.db.get(landing.publicationId))!;
 // The campaign of the ad link that opened the quiz; a recovered session keeps its own.
 const campaign=cleanAttribution(attribution);
 const id=await ctx.db.insert('quizSessions',{storeId:store._id,landingId:landing._id,publicationId:publication._id,ipHash,...(ip?{ip}:{}),...(campaign?{attribution:campaign}:{}),tokenHash:hash,...initialSession(publication.content),updatedAt:Date.now()});
 return response(ctx,await ctx.db.get(id));
}});
export const recover = query({args:{token:v.string()},handler:async(ctx,{token})=>response(ctx,await authorizedSession(ctx,token))});
export const saveAnswer = mutation({args:{token:v.string(),revision:v.number(),commandId:v.string(),direction:v.union(v.literal('next'),v.literal('back')),value:v.any()},handler:async(ctx,args)=>{
 if(!/^[a-zA-Z0-9-]{16,64}$/.test(args.commandId))fail('Invalid request.');
 const session=await authorizedSession(ctx,args.token);if(session.lastCommand===args.commandId)return response(ctx,session);
 const publication=(await ctx.db.get(session.publicationId))!;
 const state=advanceSession(publication.content,session,args);
 const step=publication.content.steps.find((s:any)=>s.id===session.currentStep);
 const contactStep=args.direction==='next' && step?.type==='contact';
 const consent=contactStep?{accepted:Boolean(state.contact?.consent),at:Date.now(),text:step.consentText??'',publicationId:publication._id}:session.consent;
 await ctx.db.patch(session._id,{...state,resultId:state.resultId,completedAt:state.completedAt,consent:Object.keys(state.contact??{}).length?consent:undefined,
  stepEvents:args.direction==='next'&&!(session.stepEvents??[]).some(e=>e.stepId===step.id)?[...(session.stepEvents??[]),{stepId:step.id,at:Date.now()}]:session.stepEvents,
  firstCompletedAt:session.firstCompletedAt??state.completedAt, contactCapturedAt:session.contactCapturedAt??((state.contact?.name||state.contact?.email)?Date.now():undefined),updatedAt:Date.now()});
 return response(ctx,await ctx.db.get(session._id));
}});
export const sessions = query({args:{storeId:v.id('stores'),cursor:v.union(v.string(),v.null())},handler:async(ctx,{storeId,cursor})=>{
 await requireAdmin(ctx);const page=await ctx.db.query('quizSessions').withIndex('by_store',q=>q.eq('storeId',storeId)).order('desc').paginate({cursor,numItems:40});
 return {...page,page:page.page.map(({tokenHash,ipHash,ip,...row})=>row)};
}});
export const detail = query({args:{sessionId:v.id('quizSessions')},handler:async(ctx,{sessionId})=>{
 await requireAdmin(ctx);const session=await ctx.db.get(sessionId);if(!session)return null;
 const {tokenHash,ipHash,ip,...row}=session;
 const orders=await ctx.db.query('orders').withIndex('by_quiz',q=>q.eq('quizSessionId',sessionId)).collect();
 return {...row,quiz:(await ctx.db.get(session.publicationId))!.content,orders};
}});
export const remove = mutation({args:{sessionId:v.id('quizSessions')},handler:async(ctx,{sessionId})=>{
 await requireAdmin(ctx);const session=await ctx.db.get(sessionId);if(!session)return;
 for(const order of await ctx.db.query('orders').withIndex('by_quiz',q=>q.eq('quizSessionId',sessionId)).collect())await ctx.db.patch(order._id,{quizSessionId:undefined});
 await ctx.db.delete(sessionId);
}});
// Name and email the visitor typed in this store's quiz, to prefill its checkout. Only the
// holder of the session token sees them; anything else returns null instead of failing.
export const checkoutContact = query({args:{subdomain:v.string(),token:v.string()},handler:async(ctx,{subdomain,token})=>{
 const store=await publicStore(ctx,subdomain);if(!store || store.status!=='active')return null;
 const hash=await tokenHash(token);
 const session=await ctx.db.query('quizSessions').withIndex('by_token',q=>q.eq('tokenHash',hash)).unique();
 if(!session || session.storeId!==store._id)return null;
 const name=typeof session.contact?.name==='string'?session.contact.name.trim().slice(0,100):'';
 const email=typeof session.contact?.email==='string'?session.contact.email.trim().slice(0,254):'';
 return name||email?{name,email}:null;
}});
export const checkoutArrival = mutation({args:{token:v.string()},handler:async(ctx,{token})=>{
 const session=await authorizedSession(ctx,token);if(!session.completedAt)fail('Please finish the quiz first.');
 if(!session.checkoutAt)await ctx.db.patch(session._id,{checkoutAt:Date.now()});
}});
const emptyFunnel=()=>({sources:['classic','quiz','direct'].map(origin=>({origin,visits:0,checkout:0,purchases:0})),started:0,completed:0,contacts:0,checkout:0,steps:{} as Record<string,number>});
export const funnelPage=internalQuery({args:{storeId:v.id('stores'),table:v.union(v.literal('quizSessions'),v.literal('orders'),v.literal('pageViews')),cursor:v.union(v.string(),v.null()),before:v.number()},handler:async(ctx,{storeId,table,cursor,before})=>{
 await requireAdmin(ctx);
 const page=table==='pageViews'?await ctx.db.query('pageViews').withIndex('by_store_day',q=>q.eq('storeId',storeId)).paginate({cursor,numItems:100}):table==='orders'?await ctx.db.query('orders').withIndex('by_store',q=>q.eq('storeId',storeId)).paginate({cursor,numItems:100}):await ctx.db.query('quizSessions').withIndex('by_store',q=>q.eq('storeId',storeId)).paginate({cursor,numItems:20});
 const totals=emptyFunnel();
 for(const row of page.page as any[]){
  if(row._creationTime>before)continue;
  if(table==='quizSessions'){
   totals.started++;if(row.firstCompletedAt||row.completedAt)totals.completed++;if(row.contactCapturedAt||row.contact?.email||row.contact?.name)totals.contacts++;if(row.checkoutAt)totals.checkout++;
   for(const id of row.stepEvents?.map((e:any)=>e.stepId)??row.history)totals.steps[id]=(totals.steps[id]??0)+1;
  }else{
   const origin=row.origin??(table==='pageViews'&&row.page==='landing'?'classic':'direct');const source=totals.sources.find(s=>s.origin===origin)!;
   if(table==='orders'){if(!row.parentOrderId&&row.status==='paid')source.purchases++;}
   else if(row.page==='landing')source.visits++;else if(row.page==='checkout')source.checkout++;
  }
 }
 return {totals,cursor:page.continueCursor,done:page.isDone};
}});
export const funnel=action({args:{storeId:v.id('stores')},handler:async(ctx,{storeId})=>{
 await requireAdmin(ctx);const result=emptyFunnel(),before=Date.now();
 for(const table of ['quizSessions','orders','pageViews']){
  let cursor:string|null=null;
  for(;;){const page:any=await ctx.runQuery(makeFunctionReference<'query'>('quizzes:funnelPage'),{storeId,table,cursor,before});
   for(const key of ['started','completed','contacts','checkout'] as const)result[key]+=page.totals[key];
   for(const [id,count]of Object.entries(page.totals.steps))result.steps[id]=(result.steps[id]??0)+(count as number);
   for(const source of result.sources){const values=page.totals.sources.find((s:any)=>s.origin===source.origin);source.visits+=values.visits;source.checkout+=values.checkout;source.purchases+=values.purchases;}
   if(page.done)break;cursor=page.cursor;
  }
 }
 return {...result,steps:Object.entries(result.steps),asOf:before};
}});

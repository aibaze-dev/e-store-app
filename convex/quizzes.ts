import { saveQuizDraft, publishQuiz } from './lib/quiz_records';
import { v } from 'convex/values';
import { mutation, query, type QueryCtx } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { forStore, publicStore, setAddress, purchaseContent } from './lib/landing_records';
import { buildLandingView } from './lib/landing_view';
import { fail } from './lib/validation';
import { assertQuiz, createQuizTemplate, initialSession, advanceSession } from '../shared/quiz.js';

export async function tokenHash(token: string) {
 if(!/^[a-zA-Z0-9-]{64,128}$/.test(token)) fail('Token de recuperación inválido.');
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
 return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function authorizedSession(ctx: QueryCtx, token: string) {
 const hash=await tokenHash(token);
 const session=await ctx.db.query('quizSessions').withIndex('by_token',q=>q.eq('tokenHash',hash)).unique();
 if(!session) fail('No se encontró la sesión.');
 const landing=await ctx.db.get(session.landingId),store=await ctx.db.get(session.storeId);
 if(!landing?.publicationId || store?.status!=='active') fail('Este quiz no está publicado.');
 return session;
}
async function response(ctx: QueryCtx, session: any) {
 const publication=await ctx.db.get(session.publicationId);
 return {quiz:publication!.content,session:{revision:session.revision,lastCommand:session.lastCommand,currentStep:session.currentStep,history:session.history,answers:session.answers,calculations:session.calculations,...(session.resultId?{resultId:session.resultId}:{}),...(session.completedAt?{completedAt:session.completedAt}:{})}};
}
export const get = query({args:{storeId:v.id('stores')},handler:async(ctx,{storeId})=>{
 await requireAdmin(ctx); const store=await ctx.db.get(storeId); if(!store)return null;
 const landing=await forStore(ctx,storeId,'quiz'); const product=await ctx.db.get(store.offer.mainProductId);
 return {landing,quiz:landing?.quizDraft ?? createQuizTemplate(product?.name),subdomain:store.subdomain ?? (await forStore(ctx,storeId))?.subdomain ?? '',view:await buildLandingView(ctx,store,landing ?? {_id:'',storeId,subdomain:'',template:'quiz'} as any,await purchaseContent(ctx,store,true))};
}});
export const save = mutation({args:{storeId:v.id('stores'),subdomain:v.string(),quiz:v.any()},handler:async(ctx,args)=>{
 await requireAdmin(ctx);return saveQuizDraft(ctx,args.storeId,args.subdomain,args.quiz);
}});
export const publish = mutation({args:{storeId:v.id('stores')},handler:async(ctx,{storeId})=>{
 await requireAdmin(ctx);return publishQuiz(ctx,storeId);
}});
export const publicConfig = query({args:{subdomain:v.string()},handler:async(ctx,{subdomain})=>{
 const store=await publicStore(ctx,subdomain);if(!store || store.status!=='active')return null;
 const landing=await forStore(ctx,store._id,'quiz');if(!landing?.publicationId)return null;
 return (await ctx.db.get(landing.publicationId))!.content;
}});
export const start = mutation({args:{subdomain:v.string(),token:v.string()},handler:async(ctx,{subdomain,token})=>{
 const hash=await tokenHash(token);const store=await publicStore(ctx,subdomain);
 if(!store || store.status!=='active')fail('Quiz no disponible.');
 const landing=await forStore(ctx,store._id,'quiz');if(!landing?.publicationId)fail('Quiz no publicado.');
 const existing=await ctx.db.query('quizSessions').withIndex('by_token',q=>q.eq('tokenHash',hash)).unique();
 if(existing){if(existing.storeId!==store._id)fail('Sesión de otra tienda.');return response(ctx,existing);}
 const publication=(await ctx.db.get(landing.publicationId))!;
 const id=await ctx.db.insert('quizSessions',{storeId:store._id,landingId:landing._id,publicationId:publication._id,tokenHash:hash,...initialSession(publication.content),updatedAt:Date.now()});
 return response(ctx,await ctx.db.get(id));
}});
export const recover = query({args:{token:v.string()},handler:async(ctx,{token})=>response(ctx,await authorizedSession(ctx,token))});
export const saveAnswer = mutation({args:{token:v.string(),revision:v.number(),commandId:v.string(),direction:v.union(v.literal('next'),v.literal('back')),value:v.any()},handler:async(ctx,args)=>{
 if(!/^[a-zA-Z0-9-]{16,64}$/.test(args.commandId))fail('Comando inválido.');
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
 return {...page,page:page.page.map(({tokenHash,...row})=>row)};
}});
export const detail = query({args:{sessionId:v.id('quizSessions')},handler:async(ctx,{sessionId})=>{
 await requireAdmin(ctx);const session=await ctx.db.get(sessionId);if(!session)return null;
 const {tokenHash,...row}=session;
 const orders=(await ctx.db.query('orders').withIndex('by_store',q=>q.eq('storeId',session.storeId)).collect()).filter(o=>o.quizSessionId===sessionId);
 return {...row,quiz:(await ctx.db.get(session.publicationId))!.content,orders};
}});
export const remove = mutation({args:{sessionId:v.id('quizSessions')},handler:async(ctx,{sessionId})=>{
 await requireAdmin(ctx);const session=await ctx.db.get(sessionId);if(!session)return;
 for(const order of await ctx.db.query('orders').withIndex('by_store',q=>q.eq('storeId',session.storeId)).collect())if(order.quizSessionId===sessionId)await ctx.db.patch(order._id,{quizSessionId:undefined});
 await ctx.db.delete(sessionId);
}});
export const checkoutArrival = mutation({args:{token:v.string()},handler:async(ctx,{token})=>{
 const session=await authorizedSession(ctx,token);if(!session.completedAt)fail('Quiz incompleto.');
 if(!session.checkoutAt)await ctx.db.patch(session._id,{checkoutAt:Date.now()});
}});
export const funnel = query({args:{storeId:v.id('stores')},handler:async(ctx,{storeId})=>{
 await requireAdmin(ctx);
 const sessions=await ctx.db.query('quizSessions').withIndex('by_store',q=>q.eq('storeId',storeId)).collect();
 const orders=await ctx.db.query('orders').withIndex('by_store',q=>q.eq('storeId',storeId)).collect();
 const views=await ctx.db.query('pageViews').withIndex('by_store_day',q=>q.eq('storeId',storeId)).collect();
 return {sources:['classic','quiz','direct'].map(origin=>({origin,visits:views.filter(v=>v.page==='landing'&&(v.origin??'classic')===origin).length,checkout:views.filter(v=>v.page==='checkout'&&(v.origin??'direct')===origin).length,purchases:orders.filter(o=>!o.parentOrderId&&o.status==='paid'&&(o.origin??'direct')===origin).length})),started:sessions.length,completed:sessions.filter(s=>s.firstCompletedAt||s.completedAt).length,contacts:sessions.filter(s=>s.contactCapturedAt||s.contact?.email||s.contact?.name).length,checkout:sessions.filter(s=>s.checkoutAt).length,steps:Object.entries(sessions.reduce((counts:any,s)=>{for(const id of s.stepEvents?.map(e=>e.stepId)??s.history)counts[id]=(counts[id]??0)+1;return counts;},{}))};
}});

import type { MutationCtx, Id } from './functions';
import { forStore, resolveAddress, purchaseContent } from './landing_records';
import { fail } from './validation';
import { assertQuiz } from '../../shared/quiz.js';
// assertQuiz throws a plain Error; ConvexError keeps its message visible in the panel.
const checkedQuiz=(value:unknown,publishing=false)=>{try{return assertQuiz(value,publishing);}catch(e){fail(e instanceof Error?e.message:'Quiz inválido.');}};
export async function saveQuizDraft(ctx:MutationCtx,storeId:Id<'stores'>,address:string|undefined,value:unknown){
 const store=await ctx.db.get(storeId);if(!store)fail('Tienda no disponible.');
 const quiz=checkedQuiz(value);const subdomain=await resolveAddress(ctx,storeId,address);
 const landing=await forStore(ctx,storeId,'quiz');
 if(landing){await ctx.db.patch(landing._id,{quizDraft:quiz});return landing._id;}
 return ctx.db.insert('landings',{storeId,subdomain,template:'quiz',draft:await purchaseContent(ctx,store,true),quizDraft:quiz});
}
export async function publishQuiz(ctx:MutationCtx,storeId:Id<'stores'>){
 const landing=await forStore(ctx,storeId,'quiz');if(!landing?.quizDraft)fail('Guardá el quiz antes de publicar.');
 const content=checkedQuiz(landing.quizDraft,true);
 const publicationId=await ctx.db.insert('quizPublications',{storeId,landingId:landing._id,content});
 await ctx.db.patch(landing._id,{publicationId,publishedAt:Date.now()});
 const store=(await ctx.db.get(storeId))!;
 if(!store.purchasePublished)await ctx.db.patch(storeId,{purchasePublished:await purchaseContent(ctx,store,true)});
 return publicationId;
}

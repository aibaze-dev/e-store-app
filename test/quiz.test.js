import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from './api';
import { backend, signedIn, product, content, mockStripe, sendWebhook, stripeEvent, WEBHOOK_SECRET } from './helpers';
import { createAdvancedQuizTemplate as createQuizTemplate, createQuizTemplate as createFunnelTemplate, feedbackFor, gaugeFor, statPercent, personalize, validateQuiz, assertQuiz, evaluate, contextFor, initialSession, advanceSession, validateAnswer, newStep, nextStep, resultFor, applicableQuestions } from '../shared/quiz.js';
vi.mock('../convex/lib/analytics_ip', async original => ({...await original(),requestIp:vi.fn(async()=> '192.0.2.1')}));
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const command=(session,value,direction='next')=>({revision:session.revision,commandId:crypto.randomUUID(),value,direction});
const answerFor=step=>({single:step.options?.[0]?.id,multiple:[step.options?.[0]?.id],number:15,measure:{value:2,unit:'hours'},date:'2026-12-01',text:'Organizarme',contact:{name:'Ana',email:'ana@example.com',consent:false}}[step.type]??null);
const tiny=()=>{const q=createQuizTemplate('Guía');q.steps=[newStep('single','choice'),{...newStep('contact','contact'),required:true}];q.calculations=[];q.results=[{id:'general',default:true,title:'Resultado',blocks:[{id:'offer',type:'offer'}]}];return q;};
beforeEach(()=>{vi.stubEnv('ADMIN_EMAILS','owner@example.com');vi.stubEnv('STRIPE_SECRET_KEY','sk_test_only');vi.stubEnv('STRIPE_WEBHOOK_SECRET',WEBHOOK_SECRET);});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function fixture(){const t=backend(),admin=await signedIn(t,'owner@example.com');const main=await admin.mutation(api.products.create,product('Guía','guide'));const storeId=await admin.mutation(api.stores.create,{name:'Tienda',status:'active',currency:'usd',offer:{mainProductId:main,price:2700,bonuses:[],upsells:[]},postPurchase:{enabled:false,price:0},tracking:{metaPixelId:''}});return {t,admin,storeId,main};}
async function publish(f,q=tiny()){await f.admin.mutation(api.quizzes.save,{storeId:f.storeId,subdomain:'guide',quiz:q});await f.admin.mutation(api.quizzes.publish,{storeId:f.storeId});}
async function complete(f,key){let data=await f.t.mutation(api.quizzes.start,{subdomain:'guide',token:key});while(data.session.currentStep){const step=data.quiz.steps.find(s=>s.id===data.session.currentStep);data=await f.t.mutation(api.quizzes.saveAnswer,{token:key,...command(data.session,answerFor(step))});}return data;}
describe('quiz language',()=>{
 it('runs the full template, preserving units, optional dates, calculations and profile',()=>{const q=createQuizTemplate();expect(validateQuiz(q,true)).toEqual([]);let s=initialSession(q);while(s.currentStep){s=advanceSession(q,s,command(s,answerFor(q.steps.find(x=>x.id===s.currentStep))),100);}expect(s.calculations.month).toBe(420);expect(s.answers.weekly).toEqual({value:2,unit:'hours'});expect(s.resultId).toBe('general');expect(s.completedAt).toBe(100);});
 it('evaluates arithmetic, scores, dates and missing data without zero coercion',()=>{const q=createQuizTemplate(),ctx=contextFor(q,{minutes:10,experience:'new',weekly:{value:2,unit:'hours'},start:'2026-11-01',motivation:'2026-11-15'});const ref=r=>({op:'ref',ref:r});expect(evaluate(ref('score:weekly'),ctx)).toBe(120);expect(evaluate({op:'days',args:[ref('answer:start'),ref('answer:motivation')]},ctx)).toBe(14);expect(evaluate({op:'divide',args:[{op:'const',value:1},{op:'const',value:0}]},ctx)).toBeNull();expect(contextFor(q).calculations.month).toBeNull();expect(evaluate({op:'power',args:[{op:'const',value:10},{op:'const',value:1000}]},ctx)).toBeNull();for(const [op,expected] of [['add',5],['subtract',1],['multiply',6],['divide',1.5],['power',9],['min',2],['max',3],['round',3]])expect(evaluate({op,args:[{op:'const',value:3},{op:'const',value:2}]},ctx)).toBe(expected);});
 it('validates exclusive choices, limits, empty optional inputs, measures and real calendar dates',()=>{const q=createQuizTemplate();expect(()=>validateAnswer(q.steps.find(s=>s.id==='goals'),['learn','none'])).toThrow();expect(()=>validateAnswer(q.steps.find(s=>s.id==='minutes'),Infinity)).toThrow();expect(validateAnswer(q.steps.find(s=>s.id==='start'),null)).toBeNull();expect(()=>validateAnswer(q.steps.find(s=>s.id==='start'),'2026-02-30')).toThrow();expect(()=>validateAnswer(q.steps.find(s=>s.id==='weekly'),{value:1,unit:'hacked'})).toThrow();});
 it('rejects cycles, unknown references, backwards jumps, self visibility and malformed URLs',()=>{let q=tiny();q.calculations=[{id:'a',expression:{op:'ref',ref:'calc:b'}},{id:'b',expression:{op:'ref',ref:'calc:a'}}];expect(validateQuiz(q,true).join()).toMatch(/circular/);q=tiny();q.steps[1].jumps=[{target:'choice'}];expect(validateQuiz(q,true).join()).toMatch(/adelante/);q=tiny();q.calculations=[{id:'a',expression:{op:'ref',ref:'answer:choice'}}];q.steps[0].when={mode:'all',conditions:[{ref:'calc:a',operator:'answered'}]};expect(validateQuiz(q,true).join()).toMatch(/propia/);q=tiny();q.identity.logoUrl='javascript:alert(1)';expect(()=>assertQuiz(q)).toThrow();q=tiny();q.results[0].title='{{answer:missing}}';expect(validateQuiz(q,true).join()).toMatch(/Variable desconocida/);});
 it('follows first matching forward jump, skips hidden questions and back invalidates downstream answers',()=>{const q=tiny();q.steps.splice(1,0,newStep('text','extra'));q.steps[0].jumps=[{target:'contact',when:{mode:'any',conditions:[{ref:'answer:choice',operator:'eq',value:'option1'}]}}];let s=initialSession(q);expect(applicableQuestions(q,s)).toHaveLength(2);s=advanceSession(q,s,command(s,'option1'));expect(s.currentStep).toBe('contact');expect(applicableQuestions(q,s)).toHaveLength(1);s=advanceSession(q,s,command(s,{name:'Ana',email:'a@b.co'}));s=advanceSession(q,s,command(s,null,'back'));s=advanceSession(q,s,command(s,null,'back'));expect(s.currentStep).toBe('choice');expect(s.answers.contact).toBeUndefined();s=advanceSession(q,s,command(s,'option2'));expect(s.currentStep).toBe('extra');expect(resultFor(q,s.answers).id).toBe('general');});
});
describe('quiz persistence and checkout',()=>{
 it('publishes independently, keeps classic compatibility, shared amount and direct checkout',async()=>{const f=await fixture();await f.admin.mutation(api.landings.saveDraft,{storeId:f.storeId,subdomain:'guide',template:'classic',draft:content});await f.admin.mutation(api.landings.publish,{storeId:f.storeId});await publish(f);expect(await f.admin.query(api.landings.list,{storeId:f.storeId})).toHaveLength(2);expect((await f.admin.query(api.landings.getForStore,{storeId:f.storeId})).template).toBe('classic');await f.admin.mutation(api.landings.unpublish,{storeId:f.storeId,type:'classic'});expect(await f.t.query(api.storefront.getLanding,{subdomain:'guide'})).toBeNull();expect((await f.t.query(api.storefront.getCheckout,{subdomain:'guide'})).offer.main.price).toBe(2700);mockStripe();await f.t.action(api.checkout.start,{subdomain:'guide',upsellProductIds:[],attemptId:crypto.randomUUID(),via:'path'});const orders=await f.t.run(ctx=>ctx.db.query('orders').collect());expect(orders[0]).toMatchObject({origin:'direct',total:2700});});
 it('recovers privately, deduplicates retries, pins publication, blocks unpublished sessions',async()=>{const f=await fixture();await publish(f);const key=token();let data=await f.t.mutation(api.quizzes.start,{subdomain:'guide',token:key});const args={token:key,...command(data.session,'option1')};data=await f.t.mutation(api.quizzes.saveAnswer,args);expect(await f.t.mutation(api.quizzes.saveAnswer,args)).toEqual(data);expect(await f.t.query(api.quizzes.recover,{token:key})).toEqual(data);await expect(f.t.query(api.quizzes.recover,{token:token()})).rejects.toThrow();await expect(f.t.mutation(api.quizzes.saveAnswer,{...args,commandId:crypto.randomUUID()})).rejects.toThrow(/cambió/);let q=tiny();q.steps[0].title='Nueva publicación';await publish(f,q);expect((await f.t.query(api.quizzes.recover,{token:key})).quiz.steps[0].title).not.toBe('Nueva publicación');await f.admin.mutation(api.landings.unpublish,{storeId:f.storeId,type:'quiz'});await expect(f.t.query(api.quizzes.recover,{token:key})).rejects.toThrow(/publicado/);await expect(f.t.mutation(api.quizzes.start,{subdomain:'guide',token:key})).rejects.toThrow();});
 it('stores contact without marketing consent, attributes paid orders without leaking answers to Stripe, deletes answers',async()=>{const f=await fixture();await publish(f);const key=token();const completed=await complete(f,key);expect(completed.session.resultId).toBe('general');const stripe=mockStripe();const args={subdomain:'guide',origin:'quiz',quizToken:key,upsellProductIds:[],attemptId:crypto.randomUUID(),via:'path'};await f.t.action(api.checkout.start,args);await f.t.action(api.checkout.start,args);let orders=await f.t.run(ctx=>ctx.db.query('orders').collect());expect(orders).toHaveLength(1);expect(orders[0]).toMatchObject({origin:'quiz',total:2700});expect(JSON.stringify(stripe.requests)).not.toContain('ana@example.com');expect(JSON.stringify(stripe.requests)).not.toContain(key);const list=await f.admin.query(api.quizzes.sessions,{storeId:f.storeId,cursor:null});expect(list.page[0].consent.accepted).toBe(false);expect(list.page[0].contact.email).toBe('ana@example.com');expect(list.page[0].tokenHash).toBeUndefined();await sendWebhook(f.t,stripeEvent('checkout.session.completed',{id:'cs_test_1',payment_status:'paid',amount_total:2700,currency:'usd',customer_details:{email:'buyer@example.com',name:'Buyer'}}));const detail=await f.admin.query(api.quizzes.detail,{sessionId:list.page[0]._id});expect(detail.orders[0].status).toBe('paid');await f.admin.mutation(api.quizzes.remove,{sessionId:detail._id});await expect(f.t.query(api.quizzes.recover,{token:key})).rejects.toThrow();orders=await f.t.run(ctx=>ctx.db.query('orders').collect());expect(orders[0]).toMatchObject({origin:'quiz',status:'paid'});expect(orders[0].quizSessionId).toBeUndefined();});
 it('rejects forged origin, incomplete session, cross-store token, and anonymous admin operations',async()=>{const f=await fixture();await publish(f);await expect(f.t.action(api.quizzes.funnel,{storeId:f.storeId})).rejects.toThrow();const key=token();await f.t.mutation(api.quizzes.start,{subdomain:'guide',token:key});mockStripe();const args={subdomain:'guide',origin:'quiz',quizToken:key,upsellProductIds:[],attemptId:crypto.randomUUID(),via:'path'};await expect(f.t.action(api.checkout.start,args)).rejects.toThrow(/Completá/);await expect(f.t.action(api.checkout.start,{...args,quizToken:undefined})).rejects.toThrow();for(const [name,payload]of [['get',{storeId:f.storeId}],['sessions',{storeId:f.storeId,cursor:null}]])await expect(f.t.query(api.quizzes[name],payload)).rejects.toThrow();await expect(f.t.mutation(api.quizzes.save,{storeId:f.storeId,subdomain:'guide',quiz:tiny()})).rejects.toThrow();await expect(f.t.mutation(api.quizzes.publish,{storeId:f.storeId})).rejects.toThrow();const second=await f.admin.mutation(api.stores.create,{name:'Otra',status:'active',currency:'usd',offer:{mainProductId:f.main,price:2700,bonuses:[],upsells:[]},postPurchase:{enabled:false,price:0},tracking:{metaPixelId:''}});await f.admin.mutation(api.quizzes.save,{storeId:second,subdomain:'other',quiz:tiny()});await f.admin.mutation(api.quizzes.publish,{storeId:second});await expect(f.t.mutation(api.quizzes.start,{subdomain:'other',token:key})).rejects.toThrow(/otra tienda/);});
 it('migrates legacy records idempotently preserving IDs, URLs, drafts and published content',async()=>{const f=await fixture();const id=await f.t.run(ctx=>ctx.db.insert('landings',{storeId:f.storeId,subdomain:'legacy',template:'classic',draft:content,published:content}));await f.admin.mutation(api.landings.migrate,{cursor:null});await f.admin.mutation(api.landings.migrate,{cursor:null});expect((await f.admin.query(api.landings.getForStore,{storeId:f.storeId}))._id).toBe(id);expect((await f.t.query(api.storefront.getCheckout,{subdomain:'legacy'})).content.hero.title).toBe(content.hero.title);});
 it('AI returns validated review-only proposal, handles invalid output and provider failure',async()=>{const f=await fixture();const q=tiny();const args={storeId:f.storeId,quiz:q,audience:'Lectores',goal:'Aprender',tone:'Cercano',length:3};await expect(f.admin.action(api.quiz_wizard.generate,args)).rejects.toThrow(/configurada/);vi.stubEnv('OPENAI_API_KEY','test');const result={title:'Inicio',description:'Conocé tu guía',steps:[{type:'single',title:'¿Qué buscás?',description:'Elegí',options:[{label:'Aprender',description:''},{label:'Practicar',description:''}]}],results:[{id:'general',title:'Tu propuesta',description:'Revisá el contenido'}]};vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]})));const proposal=await f.admin.action(api.quiz_wizard.generate,args);expect(validateQuiz(proposal,true)).toEqual([]);expect(proposal.steps).toHaveLength(3);expect(await f.admin.query(api.landings.list,{storeId:f.storeId})).toHaveLength(0);result.steps[0].type='javascript';await expect(f.admin.action(api.quiz_wizard.generate,args)).rejects.toThrow();vi.stubGlobal('fetch',async()=>{throw new Error('offline');});await expect(f.admin.action(api.quiz_wizard.generate,args)).rejects.toThrow(/válida/);});
});

describe('simplified quiz authoring and shared presentation', () => {
 it('generates a replacement proposal without accumulating questions or touching the published version', async () => {
  const f=await fixture();const q=createQuizTemplate('Guía');await publish(f,q);
  vi.stubEnv('OPENAI_API_KEY','test');
  const output={title:'Encontrá tu camino',description:'Respondé unas preguntas',steps:Array.from({length:5},(_,i)=>({type:'single',title:`Pregunta ${i+1}`,description:'Elegí una opción',options:[{label:'A',description:''},{label:'B',description:''}]})),results:[{id:'general',title:'Tu propuesta',description:'Conocé el contenido'}]};
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]})));
  const args={storeId:f.storeId,quiz:q,audience:'Principiantes',goal:'Conocer sus objetivos',tone:'Cercano',length:5,mode:'replace'};
  const proposal=await f.admin.action(api.quiz_wizard.generate,args);
  expect(proposal.steps.filter(s=>s.type==='single')).toHaveLength(5);
  expect(proposal.steps).toHaveLength(8);
  expect(proposal.steps.some(s=>s.id==='minutes')).toBe(false);
  expect(proposal.calculations).toEqual([]);
  expect(proposal.identity).toEqual(q.identity);
  expect(proposal.results[0].blocks.some(b=>b.type==='offer')).toBe(true);
  expect(validateQuiz(proposal,true)).toEqual([]);
  expect((await f.t.query(api.quizzes.publicConfig,{subdomain:'guide'})).steps).toEqual(q.steps);
  expect((await f.admin.query(api.quizzes.get,{storeId:f.storeId})).quiz.steps).toEqual(q.steps);
  output.steps.pop();await expect(f.admin.action(api.quiz_wizard.generate,args)).rejects.toThrow(/cantidad/);
 });
 it('supports type-aware operations while legacy calls still resolve classic',async()=>{
  const f=await fixture();await f.admin.mutation(api.landings.saveDraft,{storeId:f.storeId,subdomain:'guide',type:'quiz',quiz:tiny()});
  await f.admin.mutation(api.landings.publish,{storeId:f.storeId,type:'quiz'});
  expect((await f.admin.query(api.landings.getForStore,{storeId:f.storeId,type:'quiz'})).publicationId).toBeTruthy();
  expect(await f.admin.query(api.landings.getForStore,{storeId:f.storeId})).toBeNull();
  expect((await f.admin.query(api.landings.preview,{storeId:f.storeId,type:'quiz'})).quiz).toEqual(tiny());
 });
 it('separates shared draft from published content and supports a quiz-only store',async()=>{
  const f=await fixture();await publish(f);
  const draft=structuredClone((await f.admin.query(api.purchase_presentation.get,{storeId:f.storeId})).draft);
  draft.footer.brandName='Mi marca';
  await f.admin.mutation(api.purchase_presentation.save,{storeId:f.storeId,draft,publish:false});
  expect((await f.t.query(api.storefront.getCheckout,{subdomain:'guide'})).content.footer.brandName).not.toBe('Mi marca');
  await f.admin.mutation(api.purchase_presentation.save,{storeId:f.storeId,draft,publish:true});
  expect((await f.t.query(api.storefront.getCheckout,{subdomain:'guide'})).content.footer.brandName).toBe('Mi marca');
  await expect(f.t.mutation(api.purchase_presentation.save,{storeId:f.storeId,draft,publish:true})).rejects.toThrow();
 });
 it('counts each step and completion once despite retries, going back and recompleting',async()=>{
  const f=await fixture();await publish(f);const key=token();let d=await complete(f,key);
  d=await f.t.mutation(api.quizzes.saveAnswer,{token:key,...command(d.session,null,'back')});
  const args={token:key,...command(d.session,{name:'Ana',email:'ana@example.com',consent:false})};
  await f.t.mutation(api.quizzes.saveAnswer,args);await f.t.mutation(api.quizzes.saveAnswer,args);
  await f.t.mutation(api.quizzes.checkoutArrival,{token:key});await f.t.mutation(api.quizzes.checkoutArrival,{token:key});
  const report=await f.admin.action(api.quizzes.funnel,{storeId:f.storeId});
  expect(report).toMatchObject({started:1,completed:1,contacts:1,checkout:1});
  expect(Object.fromEntries(report.steps)).toEqual({choice:1,contact:1});
  const row=(await f.admin.query(api.quizzes.sessions,{storeId:f.storeId,cursor:null})).page[0];
  await expect(f.t.query(api.quizzes.detail,{sessionId:row._id})).rejects.toThrow();
  await expect(f.t.mutation(api.quizzes.remove,{sessionId:row._id})).rejects.toThrow();
  expect(row.ipHash).toBeUndefined();
 });
 it('retains bonuses, extras, downsell, post-purchase attribution and delivery after webhooks',async()=>{
  const f=await fixture();const extra=await f.admin.mutation(api.products.create,product('Extra','extra'));
  await f.t.run(async ctx=>{await ctx.db.patch(f.storeId,{offer:{mainProductId:f.main,price:2700,bonuses:[{productId:extra,referenceValue:900}],upsells:[{productId:extra,price:500,displayOrder:0}]},postPurchase:{enabled:true,productId:extra,price:700},downsell:{enabled:true,percent:20,modalTitle:'Oferta',modalSubtitle:'',acceptText:'Aceptar',declineText:'Salir',pageTitle:'Oferta',pageSubtitle:''}});});
  await publish(f);const key=token();await complete(f,key);mockStripe();
  const args={subdomain:'guide',origin:'quiz',quizToken:key,upsellProductIds:[extra],via:'path'};
  await f.t.action(api.checkout.start,{...args,attemptId:crypto.randomUUID()});
  let orders=await f.t.run(ctx=>ctx.db.query('orders').collect());
  expect(orders[0].total).toBe(3200);expect(orders[0].items.map(i=>i.role)).toEqual(['main','bonus','upsell']);
  await sendWebhook(f.t,stripeEvent('checkout.session.completed',{id:'cs_test_1',payment_status:'paid',amount_total:3200,currency:'usd'}));
  await f.t.action(api.checkout.startPostPurchase,{parentSessionId:'cs_test_1',attemptId:crypto.randomUUID(),via:'path'});
  orders=await f.t.run(ctx=>ctx.db.query('orders').collect());
  expect(orders[1]).toMatchObject({origin:'quiz',quizSessionId:orders[0].quizSessionId,total:700,parentOrderId:orders[0]._id});
  await sendWebhook(f.t,stripeEvent('checkout.session.completed',{id:'cs_test_2',payment_status:'paid',amount_total:700,currency:'usd'}));
  expect((await f.t.query(api.storefront.getDelivery,{sessionId:'cs_test_2'})).status).toBe('paid');
  await f.t.action(api.checkout.start,{...args,upsellProductIds:[],downsell:true,attemptId:crypto.randomUUID()});
  orders=await f.t.run(ctx=>ctx.db.query('orders').collect());expect(orders[2]).toMatchObject({origin:'quiz',total:2160,downsell:true});
 });
 it('rejects malformed structures and missing required contacts and preserves missing scores',()=>{
  const q=tiny();expect(()=>validateAnswer(q.steps[1],null)).toThrow();
  q.steps[0].id='constructor';expect(validateQuiz(q,true).join()).toMatch(/identificadores/);
  q.steps=[null];expect(validateQuiz(q,true).length).toBeGreaterThan(0);
  const unscored=tiny();unscored.steps[0].type='multiple';unscored.steps[0].options.forEach(o=>delete o.score);
  expect(evaluate({op:'ref',ref:'score:choice'},contextFor(unscored,{choice:['option1']}))).toBeNull();
 });
});

describe('funnel quiz: images, live feedback, loading and final page', () => {
 it('keeps a Storage VSL through draft, publication and completion', async () => {
  const f = await fixture(), q = tiny();
  const videoUrl = await f.t.run(async ctx => {
   const id = await ctx.storage.store(new Blob(['test video'], { type: 'video/mp4' }));
   return ctx.storage.getUrl(id);
  });
  const vsl = { id: 'vsl', type: 'video', title: 'Conocé tu guía', videoUrl };
  q.results[0].blocks.unshift(vsl);
  await publish(f, q);
  const completed = await complete(f, token());
  expect(completed.quiz.results[0].blocks[0]).toEqual(vsl);
  const draft = structuredClone(q);
  draft.results[0].blocks[0].videoUrl = '';
  await f.admin.mutation(api.quizzes.save, { storeId: f.storeId, subdomain: 'guide', quiz: draft });
  expect((await f.t.query(api.quizzes.publicConfig, { subdomain: 'guide' })).results[0].blocks[0]).toEqual(vsl);
  await f.admin.mutation(api.quizzes.publish, { storeId: f.storeId });
  expect((await f.t.query(api.quizzes.publicConfig, { subdomain: 'guide' })).results[0].blocks[0].videoUrl).toBe('');
 });
 it('preserves the uploaded VSL when AI replaces the questions and final page', async () => {
  const f = await fixture(), q = createFunnelTemplate('Guía');
  const vsl = q.results[0].blocks.find(b => b.type === 'video');
  Object.assign(vsl, { title: 'Mirá cómo empezar', videoUrl: 'https://example.convex.cloud/api/storage/1234-5678' });
  vi.stubEnv('OPENAI_API_KEY', 'test');
  const output = { title: 'Inicio', description: 'Tu guía', finalPage: {}, steps: [{ type: 'single', title: '¿Qué buscás?', description: '', options: [{ label: 'Aprender', description: '' }, { label: 'Practicar', description: '' }] }], results: [{ id: 'general', title: 'Tu resultado', description: '' }] };
  output.steps = Array.from({ length: 3 }, () => structuredClone(output.steps[0]));
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] })));
  const proposal = await f.admin.action(api.quiz_wizard.generate, { storeId: f.storeId, quiz: q, audience: 'Lectores', goal: 'Aprender', tone: 'Cercano', length: 3, mode: 'replace' });
  expect(proposal.results[0].blocks.find(b => b.type === 'video')).toEqual(vsl);
  expect(validateQuiz(proposal, true)).toEqual([]);
 });
 it('ships a valid default funnel that completes into the final page', () => {
  const q = createFunnelTemplate('Guía');
  expect(validateQuiz(q, true)).toEqual([]);
  let s = initialSession(q);
  while (s.currentStep) { const step = q.steps.find(x => x.id === s.currentStep); s = advanceSession(q, s, command(s, step.type === 'loading' ? null : step.type === 'intro' ? 'new' : answerFor(step))); }
  expect(s.resultId).toBe('general');
  expect(q.results[0].blocks.some(b => b.type === 'offer')).toBe(false);
 });
 it('evaluates option and range feedback, including open bounds and units', () => {
  const q = createFunnelTemplate();
  const minutes = q.steps.find(s => s.id === 'minutes');
  expect(feedbackFor(minutes, 2).tone).toBe('warn');
  expect(feedbackFor(minutes, 30).tone).toBe('good');
  expect(feedbackFor(minutes, 91).tone).toBe('bad');
  expect(feedbackFor(minutes, '')).toBeNull();
  const open = { type: 'measure', units: [{ id: 'kg', factor: 1 }, { id: 'g', factor: 0.001 }], feedbackRanges: [{ max: 1, tone: 'info', title: 'Poco' }, { min: 1.5, tone: 'good', title: 'Bien' }] };
  expect(feedbackFor(open, { value: 500, unit: 'g' }).title).toBe('Poco');
  expect(feedbackFor(open, { value: 2, unit: 'kg' }).title).toBe('Bien');
  expect(feedbackFor(open, { value: 1.2, unit: 'kg' })).toBeNull();
  expect(feedbackFor(q.steps.find(s => s.id === 'obstacle'), 'time').tone).toBe('good');
 });
 it('rejects invalid tones, ranges, loading settings and final-page references', () => {
  const broken = mutate => { const q = createFunnelTemplate(); mutate(q); return validateQuiz(q, true).join(' '); };
  expect(broken(q => { q.steps.find(s => s.id === 'minutes').feedbackRanges[0].tone = 'red'; })).toMatch(/feedback/);
  expect(broken(q => { Object.assign(q.steps.find(s => s.id === 'minutes').feedbackRanges[0], { min: 9, max: 2 }); })).toMatch(/feedback/);
  expect(broken(q => { q.steps.find(s => s.id === 'obstacle').options[0].feedback.tone = 'x'; })).toMatch(/feedback/);
  expect(broken(q => { q.steps.find(s => s.type === 'loading').durationMs = 60000; })).toMatch(/segundos/);
  expect(broken(q => { q.steps.find(s => s.id === 'goal').imageLayout = 'floating'; })).toMatch(/imagen/);
  expect(broken(q => { q.results[0].blocks.find(b => b.type === 'planSummary').items.push({ stepId: 'missing', label: 'x' }); })).toMatch(/resumen/);
  expect(broken(q => { q.results[0].blocks.find(b => b.type === 'gauge').stepId = 'goals_none'; })).toMatch(/indicador/);
  expect(broken(q => { q.results[0].blocks.find(b => b.type === 'stats').items[1].total = 40; })).toMatch(/tarjetas/);
  expect(broken(q => { q.results[0].blocks.find(b => b.type === 'nowAfter').metrics[0].now = 9; })).toMatch(/comparación/);
  expect(broken(q => { q.results[0].blocks.find(b => b.type === 'goals').stepId = 'minutes'; })).toMatch(/objetivos/);
 });
 it('going back skips the automatic loading screen', () => {
  const q = createFunnelTemplate();
  let s = initialSession(q);
  while (s.currentStep !== 'contact') { const step = q.steps.find(x => x.id === s.currentStep); s = advanceSession(q, s, command(s, step.type === 'loading' ? null : step.type === 'intro' ? 'new' : answerFor(step))); }
  s = advanceSession(q, s, command(s, null, 'back'));
  expect(s.currentStep).toBe('social');
 });
 it('personalises copy without printing missing variables', () => {
  const q = createFunnelTemplate();
  const heading = q.results[0].blocks.find(b => b.type === 'planSummary').title;
  expect(personalize(heading, contextFor(q, {}))).toBe('Tu plan está *listo*');
  expect(personalize(heading, contextFor(q, { contact: { name: 'Ana', email: '' } }))).toBe('Ana, tu plan está *listo*');
 });
 it('only admins upload step images; non-images are rejected and deleted', async () => {
  const f = await fixture();
  await expect(f.t.mutation(api.quizzes.imageUploadUrl, {})).rejects.toThrow();
  expect(typeof await f.admin.mutation(api.quizzes.imageUploadUrl, {})).toBe('string');
  // convex-test does not keep the uploaded content type, so the accepted path is not covered here.
  const image = await f.t.run(ctx => ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' })));
  await expect(f.t.mutation(api.quizzes.imageUrl, { storageId: image })).rejects.toThrow();
  expect(await f.t.run(ctx => ctx.storage.getUrl(image))).not.toBeNull();
  const html = await f.t.run(ctx => ctx.storage.store(new Blob(['<script>x</script>'], { type: 'text/html' })));
  expect(await f.admin.mutation(api.quizzes.imageUrl, { storageId: html })).toEqual({ error: expect.stringMatching(/imagen/) });
  expect(await f.t.run(ctx => ctx.storage.getUrl(html))).toBeNull();
 });
 it('moves the indicator with the chosen level or a number and follows answers in recommendation bars', () => {
  const q = createFunnelTemplate();
  const gauge = q.results[0].blocks.find(b => b.type === 'gauge'), bar = q.results[0].blocks.find(b => b.type === 'stats').items[0];
  expect(gaugeFor(gauge, contextFor(q, {}))).toBeNull();
  expect(gaugeFor(gauge, contextFor(q, { welcome: 'new' }))).toMatchObject({ percent: 0, display: 'Estoy empezando', feedback: { tone: 'info' } });
  expect(gaugeFor(gauge, contextFor(q, { welcome: 'experienced' }))).toMatchObject({ percent: 100, feedback: { title: 'Listo para profundizar' } });
  expect(gaugeFor({ stepId: 'minutes', min: 0, max: 60, ranges: [{ min: 31, tone: 'bad', title: 'Mucho' }] }, contextFor(q, { minutes: 45 }))).toMatchObject({ percent: 75, display: '45', feedback: { title: 'Mucho' } });
  expect(statPercent(bar, contextFor(q, { minutes: 60 }))).toBe(100);
  expect(statPercent(bar, contextFor(q, {}))).toBe(30);
 });
});

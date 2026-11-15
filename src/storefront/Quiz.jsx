import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api.js';
import { formatMoney, errorText } from '@/lib/format.js';
import { contextFor, effectiveStep, interpolate, displayRef, evaluate, resolveRef, matches, initialSession, advanceSession, applicableQuestions, QUESTION_TYPES, validateAnswer } from '../../shared/quiz.js';
import './quiz.css';
export const quizTokenKey = subdomain => `quiz-token:${subdomain}`;
export function readQuizToken(subdomain) {try{return sessionStorage.getItem(quizTokenKey(subdomain));}catch{return null;}}
const Media = ({src,alt=''}) => src ? <img className="quiz-image" src={src} alt={alt} onError={e=>{e.currentTarget.hidden=true;}} /> : null;
export function QuizBlocks({blocks=[],context,view,onCheckout}) {
 const t=text=>interpolate(text,context);
 const money=value=>formatMoney(value,view?.store.currency||'USD');
 return blocks.filter(b=>b.enabled!==false&&matches(b.when,context)).map(b=>{
  const data=(b.points||[]).map(p=>({label:t(p.label),value:evaluate(p.expression,context)}));
  const value=b.ref?resolveRef(b.ref,context):null;
  return <section className="quiz-block" key={b.id}>
   {b.title&&<h2>{t(b.title)}</h2>}{b.text&&<p>{t(b.text)}</p>}
   {b.type==='image'&&<Media src={b.imageUrl} alt={t(b.alt)}/>}
   {b.type==='video'&&b.videoUrl&&<video controls preload="metadata" src={b.videoUrl} aria-label={t(b.title)}/>}
   {b.type==='answers'&&<dl>{context.quiz.steps.filter(s=>context.answers[s.id]!=null&&s.type!=='contact').map(s=><div key={s.id}><dt>{t(s.title)}</dt><dd>{displayRef(`answer:${s.id}`,context)}</dd></div>)}</dl>}
   {['metric','scale'].includes(b.type)&&<><strong className="quiz-metric">{displayRef(b.ref,context)} {t(b.suffix)}</strong>{b.type==='scale'&&typeof value==='number'&&<meter min={b.min} max={b.max} value={value} aria-label={t(b.title)}/>}</>}
   {b.type==='comparison'&&<dl className="quiz-comparison">{data.map((p,i)=><div key={i}><dt>{p.label}</dt><dd>{p.value??'Sin resultado'}</dd></div>)}</dl>}
   {['line','bar'].includes(b.type)&&<><div className="quiz-chart" role="img" aria-label={t(b.title)}><ResponsiveContainer width="100%" height={220}>{b.type==='line'?<LineChart data={data}><XAxis dataKey="label"/><YAxis width={42}/><Tooltip/><Line dataKey="value" name={t(b.legend)||'Valor'} stroke="var(--quiz-accent)" connectNulls={false}/></LineChart>:<BarChart data={data}><XAxis dataKey="label"/><YAxis width={42}/><Tooltip/><Bar dataKey="value" name={t(b.legend)||'Valor'} fill="var(--quiz-accent)"/></BarChart>}</ResponsiveContainer></div><table className="quiz-data"><caption>{t(b.legend)||'Valores del gráfico'}</caption><tbody>{data.map((p,i)=><tr key={i}><th>{p.label}</th><td>{p.value??'Sin resultado'}</td></tr>)}</tbody></table></>}
   {['benefits','testimonials'].includes(b.type)&&(b.items||[]).map((item,i)=><article key={i}><Media src={item.imageUrl}/><h3>{t(item.title)}</h3><p>{t(item.text)}</p></article>)}
   {b.type==='faq'&&(b.items||[]).map((item,i)=><details key={i}><summary>{t(item.title)}</summary><p>{t(item.text)}</p></details>)}
   {b.type==='offer'&&view&&<><Media src={view.offer.main.coverUrl} alt={view.offer.main.name}/><h3>{view.offer.main.name}</h3><p>{view.offer.main.description}</p><strong className="quiz-price">{money(view.offer.main.price)}</strong><p>Pago único</p>{view.offer.bonuses.length>0&&<><h3>Bonos incluidos</h3><ul>{view.offer.bonuses.map(p=><li key={p.productId}>{p.name}</li>)}</ul></>}<button className="quiz-primary" onClick={onCheckout}>{t(b.buttonText)||'Ir al checkout'}</button></>}
   {b.type==='guarantee'&&view?.content.guarantee?.enabled!==false&&<p>{view?.content.guarantee?.text}</p>}
   {b.type==='promotion'&&view?.content.promotion?.enabled&&<p>{view.content.promotion.message}</p>}
  </section>;
 });
}
export function QuizPlayer({quiz,session,view,onCommand,onCheckout,busy=false,error='',preview=false}) {
 const [value,setValue]=useState(null),[validation,setValidation]=useState('');
 const heading=useRef(null), submitting=useRef(false);
 useEffect(()=>{setValue(session.answers[session.currentStep]??null);setValidation('');submitting.current=false;heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});},[session.revision,session.currentStep]);
 useEffect(()=>{if(!busy)submitting.current=false;},[busy]);
 const context=contextFor(quiz,session.answers),raw=quiz.steps.find(s=>s.id===session.currentStep),step=raw&&effectiveStep(raw,context);
 const result=session.currentStep===null?(quiz.results.find(r=>r.id===session.resultId)||quiz.results.find(r=>r.default)):null;
 const screen=result||step;if(!screen)return <p>Este quiz no tiene pantallas disponibles.</p>;
 const t=text=>interpolate(text,context);
 const questions=applicableQuestions(quiz,session),done=session.history.filter(id=>questions.includes(id)).length;
 const options=step?.options||[];
 async function next(answer=value){if(busy||submitting.current)return;try{validateAnswer(step,answer);setValidation('');submitting.current=true;await onCommand('next',answer);}catch(e){setValidation(e.message);}finally{submitting.current=false;}}
 function select(option){if(step.type==='multiple'){const selected=Array.isArray(value)?value:[];setValue(selected.includes(option.id)?selected.filter(id=>id!==option.id):option.exclusive?[option.id]:[...selected.filter(id=>!options.find(o=>o.id===id)?.exclusive),option.id]);}else{setValue(option.id);if(step.autoAdvance)next(option.id);}}
 return <div className="quiz-public" style={{'--quiz-accent':quiz.identity.color,'--quiz-bg':quiz.identity.background,'--quiz-text':quiz.identity.textColor}}>
  <header className="quiz-header"><div>{session.history.length>0&&<button type="button" disabled={busy} onClick={()=>onCommand('back',null)}>{quiz.identity.backText||'Atrás'}</button>}<span className="quiz-brand">{quiz.identity.logoUrl?<img src={quiz.identity.logoUrl} alt={quiz.identity.name}/>:quiz.identity.name}</span>{questions.length>0&&<span>{Math.min(done+(QUESTION_TYPES.includes(step?.type)?1:0),questions.length)}/{questions.length}</span>}</div><progress value={result?1:done} max={result?1:questions.length||1} aria-label="Progreso del quiz"/></header>
  {preview&&<p className="quiz-preview-label">Vista previa · sin contactos, pagos ni eventos reales</p>}
  <main className="quiz-column"><h1 ref={heading} tabIndex={-1}>{t(screen.title)}</h1>{screen.description&&<p className="quiz-description">{t(screen.description)}</p>}<Media src={screen.imageUrl} alt={t(screen.imageAlt)}/>
   {screen.sideImageUrl&&<img className="quiz-side-image" src={screen.sideImageUrl} alt=""/>}
   {screen.videoUrl&&<video controls preload="metadata" src={screen.videoUrl} aria-label={t(screen.title)}/>}
   {step&&<form onSubmit={e=>{e.preventDefault();next();}}><fieldset disabled={busy}>
    {options.length>0&&<div className={`quiz-options ${step.layout==='grid'?'quiz-grid':''}`} role="group" aria-label={t(step.title)}>{options.map(o=><button className="quiz-option" type="button" key={o.id} aria-pressed={Array.isArray(value)?value.includes(o.id):value===o.id} onClick={()=>select(o)}>{o.icon&&<span aria-hidden="true">{o.icon}</span>}<span><strong>{t(o.label)}</strong>{o.description&&<small>{t(o.description)}</small>}</span><Media src={o.imageUrl}/>{step.type==='multiple'&&<span aria-hidden="true">{value?.includes(o.id)?'✓':'○'}</span>}</button>)}</div>}
    {['text','number','date'].includes(step.type)&&<label className="quiz-input-label">{t(step.inputLabel)||t(step.title)}<input type={step.type} value={value??''} required={step.required} min={step.type==='date'?step.minDate:step.min} max={step.type==='date'?step.maxDate:step.max} step="any" maxLength={2000} placeholder={t(step.placeholder)} onChange={e=>setValue(step.type==='number'&&e.target.value!==''?Number(e.target.value):e.target.value)}/></label>}
    {step.type==='measure'&&<div className="quiz-measure"><label>Valor<input type="number" step="any" value={value?.value??''} onChange={e=>setValue({unit:value?.unit||step.units[0].id,value:e.target.value===''?'':Number(e.target.value)})}/></label><label>Unidad<select value={value?.unit||step.units[0].id} onChange={e=>setValue({value:value?.value??'',unit:e.target.value})}>{step.units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select></label></div>}
    {step.type==='contact'&&<div className="quiz-contact"><label>Nombre{step.nameRequired?' *':''}<input autoComplete="given-name" maxLength={120} required={step.nameRequired} value={value?.name||''} onChange={e=>setValue({...value,name:e.target.value})}/></label><label>Email{step.emailRequired?' *':''}<input type="email" autoComplete="email" maxLength={254} required={step.emailRequired} value={value?.email||''} onChange={e=>setValue({...value,email:e.target.value})}/></label>{step.consentText&&<label className="quiz-consent"><input type="checkbox" checked={value?.consent===true} onChange={e=>setValue({...value,consent:e.target.checked})}/>{t(step.consentText)}</label>}</div>}
    <QuizBlocks blocks={step.blocks} context={context} view={view} onCheckout={onCheckout}/>
    <button className="quiz-primary" type="submit">{busy?'Guardando…':t(step.buttonText)||'Continuar'}</button>
    {!step.required&&QUESTION_TYPES.includes(step.type)&&<button type="button" className="quiz-skip" onClick={()=>next(null)}>{quiz.identity.skipText||'Omitir'}</button>}
   </fieldset></form>}
   {result&&<><QuizBlocks blocks={result.blocks} context={context} view={view} onCheckout={onCheckout}/><div className={result.stickyCta?'quiz-sticky':''}><button className="quiz-primary" disabled={busy} onClick={onCheckout}>{t(result.buttonText)||'Ir al checkout'}</button></div></>}
   {(error||validation)&&<p role="alert" className="quiz-error">{validation||error}</p>}
   <footer>{quiz.identity.termsUrl&&<a href={quiz.identity.termsUrl}>Términos</a>}{quiz.identity.privacyUrl&&<a href={quiz.identity.privacyUrl}>Privacidad</a>}</footer>
  </main>
 </div>;
}
export function QuizPreview({quiz,view}) {
 const [session,setSession]=useState(()=>initialSession(quiz));const [size,setSize]=useState('desktop');const [checkout,setCheckout]=useState(false);
 return <div className="quiz-preview"><div className="quiz-preview-tools"><button onClick={()=>setSize(size==='mobile'?'desktop':'mobile')}>{size==='mobile'?'Ver escritorio':'Ver móvil'}</button><button onClick={()=>{setSession(initialSession(quiz));setCheckout(false);}}>Reiniciar prueba</button></div>{checkout&&<p role="status">El recorrido llegaría al checkout compartido: {formatMoney(view?.offer.main.price||0,view?.store.currency||'USD')}. No se creó ninguna compra.</p>}<div className={size==='mobile'?'quiz-mobile-preview':''}><QuizPlayer preview quiz={quiz} session={session} view={view} onCommand={(direction,value)=>setSession(advanceSession(quiz,session,{direction,value,revision:session.revision,commandId:crypto.randomUUID()}))} onCheckout={()=>setCheckout(true)}/></div><details className="quiz-debug"><summary>Respuestas, cálculos y perfil de prueba</summary><pre>{JSON.stringify({answers:session.answers,calculations:session.calculations,profile:session.resultId},null,2)}</pre></details></div>;
}
export default function Quiz({subdomain,view}) {
 const config=useQuery(api.quizzes.publicConfig,{subdomain});const start=useMutation(api.quizzes.start),save=useMutation(api.quizzes.saveAnswer),arrival=useMutation(api.quizzes.checkoutArrival),recordView=useMutation(api.analytics.recordView);
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);const pending=useRef(null);const navigate=useNavigate(),location=useLocation();
 const base=location.pathname.includes('/l/')?`/l/${subdomain}`:'';
 useEffect(()=>{if(!config)return;let ignore=false;setBusy(true);setError('');let token=readQuizToken(subdomain);try{if(!token){token=crypto.randomUUID()+crypto.randomUUID();sessionStorage.setItem(quizTokenKey(subdomain),token);}}catch{setError('Habilitá el almacenamiento de la pestaña para recuperar tu quiz.');setBusy(false);return;}
  start({subdomain,token}).then(value=>{if(!ignore)setData(value);},e=>{if(!ignore)setError(errorText(e,'No se pudo recuperar el quiz.'));}).finally(()=>{if(!ignore)setBusy(false);});
  crypto.subtle.digest('SHA-256',new TextEncoder().encode(`quiz-visit:${token}`)).then(bytes=>recordView({subdomain,page:'landing',origin:'quiz',eventId:Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('').slice(0,32)})).catch(()=>{});
  return()=>{ignore=true;};
 },[subdomain,Boolean(config),retry,start,recordView]);
 useEffect(()=>{if(!data)return;const result=data.session.currentStep===null;const expected=`${base}/quiz${result?'/resultado':''}`;if(location.pathname!==expected)navigate(expected,{replace:true});},[data,base,location.pathname,navigate]);
 async function command(direction,value){if(busy)return;setBusy(true);setError('');const payload={token:readQuizToken(subdomain),revision:data.session.revision,direction,value};const signature=JSON.stringify(payload);if(pending.current?.signature!==signature)pending.current={signature,commandId:crypto.randomUUID()};try{setData(await save({...payload,commandId:pending.current.commandId}));pending.current=null;}catch(e){setError(errorText(e,'No se guardó el paso. Tu respuesta sigue aquí; volvé a continuar.'));}finally{setBusy(false);}}
 async function checkout(){if(busy)return;setBusy(true);setError('');try{await arrival({token:readQuizToken(subdomain)});navigate(`${base}/checkout`,{state:{origin:'quiz'}});}catch(e){setError(errorText(e,'No se pudo continuar.'));}finally{setBusy(false);}}
 if(config===null)return <p className="p-8">Este quiz no está disponible.</p>;
 if(!data)return <div className="p-8" role="status">{error||'Preparando tu recorrido…'}{error&&<button onClick={()=>setRetry(n=>n+1)}>Reintentar</button>}</div>;
 if(!config)return <p className="p-8">Cargando…</p>;
 return <QuizPlayer quiz={data.quiz} session={data.session} view={view} onCommand={command} onCheckout={checkout} busy={busy} error={error}/>;
}

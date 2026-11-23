import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/lib/api.js';
import { Button } from '@/components/ui/button';
import { PageSkeleton, ErrorAlert } from '@/components/Field.jsx';
import { errorText } from '@/lib/format.js';
import { QuizPreview } from '@/storefront/Quiz.jsx';
import { clone, migrateGaugeRanges, removeCalculation, removeOption, validateQuiz } from '../../shared/quiz.js';
import QuizWizard from './QuizWizard.jsx';
import QuizBuilder from './QuizBuilder.jsx';
import { ImageField, UploadContext, useMediaUpload } from './ImageField.jsx';
import { Blocks, CopyField, Conditions, Expression, Reorder, StepForm, Toggle, uid } from './QuizAdvanced.jsx';
import { QField } from './QuizFields.jsx';
import './quiz-editor.css';
export { QField } from './QuizFields.jsx';

export function QuizEditorForm({initial,subdomain:address,settingsPath,backTo,view,onSave,onPublish,onGenerate,onGenerateImage,onUploadImage,published,exists=false,uploading=false}) {
 const [quiz,setQuiz]=useState(()=>migrateGaugeRanges(clone(initial))),[tab,setTab]=useState('Contenido');
 // With a saved quiz, editing is the main path; the assistant starts open only for a new one.
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[working,setBusy]=useState(false),[preview,setPreview]=useState(false),[aiOpen,setAiOpen]=useState(!exists),[dirty,setDirty]=useState(false);
 useEffect(()=>{if(!dirty)return;const warn=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const busy=working||uploading;
 const set=patch=>{setQuiz(q=>({...q,...patch}));setDirty(true);setStatus('');};
 const errors=validateQuiz(quiz,true);
 const task=async(fn,message)=>{setBusy(true);setError('');setStatus('');try{await fn();setStatus(message);}catch(e){setError(errorText(e,'No se pudo completar la operación.'));}finally{setBusy(false);}};
 const publish=()=>{if(errors.length){setError(errors.join('\n'));return;}task(async()=>{await onSave({quiz:clone(quiz)});await onPublish();setDirty(false);},'Quiz publicado.');};
 const setStep=(index,patch)=>set({steps:quiz.steps.map((s,i)=>i===index?{...s,...patch}:s)});
 const mainResult=quiz.results.find(r=>r.default);
 const setResult=patch=>set({results:quiz.results.map(r=>r.id===mainResult.id?{...r,...patch}:r)});
 return <>{backTo&&<Link to={backTo} onClick={event=>{if(dirty&&!window.confirm('Tenés cambios sin guardar en el quiz. ¿Salir igual?'))event.preventDefault();}}>← Landings</Link>}<div className="quiz-editor qe-simple-editor">
  <header className="qe-heading"><div><p className="qe-eyebrow">Landings / Quiz</p><h1>Tu quiz</h1><p>Ordená las pantallas, editá cada una y mirá cómo se ve al lado.</p></div><span className="qe-status">{published?'Publicado':'Borrador'}{dirty?' · Cambios sin guardar':''}</span></header>
  {!preview&&<QuizWizard open={aiOpen} onOpenChange={setAiOpen} exists={exists} quiz={quiz} view={view} disabled={busy} onGenerate={onGenerate} onGenerateImage={onGenerateImage} onBusy={setBusy} onApply={async proposal=>{
    const next=migrateGaugeRanges(clone(proposal));await onSave({quiz:next});setQuiz(next);setDirty(false);setStatus('Quiz generado y guardado como borrador. Ya podés probarlo.');
   }}/>}
  {(!aiOpen||preview)&&<div className="qe-toolbar">
   <Button variant="outline" disabled={busy} onClick={()=>task(async()=>{await onSave({quiz:clone(quiz)});setDirty(false);},'Borrador guardado.')}>Guardar borrador</Button>
   <Button variant="outline" disabled={busy} onClick={()=>{if(errors.length){setError(errors.join('\n'));}else setPreview(!preview);}}>{preview?'Volver a editar':'Probar quiz'}</Button>
   <Button disabled={busy} onClick={publish}>{busy?'Guardando…':'Publicar quiz'}</Button>
  </div>}
  <ErrorAlert>{error}</ErrorAlert>{status&&<p role="status">{status}</p>}
  {!address&&<div className="qe-card" role="note"><p>Antes de guardar o publicar, definí el subdominio de tu tienda en <Link to={settingsPath||'../configuracion'}>Configuración</Link>.</p></div>}
  {preview?<QuizPreview key={JSON.stringify(quiz)} quiz={quiz} view={view}/>:!aiOpen&&<>
   <nav className="qe-tabs" aria-label="Apartados del editor">{['Contenido','Diseño','Avanzado'].map(name=><button disabled={busy} key={name} onClick={()=>setTab(name)} aria-current={tab===name?'page':undefined}>{name}</button>)}</nav>
   <UploadContext.Provider value={onUploadImage}><fieldset disabled={busy} className="qe-main qe-stack">
    {tab==='Contenido'&&<QuizBuilder quiz={quiz} view={view} set={set}/>}
    {tab==='Diseño'&&<div className="qe-card qe-stack"><h2>Marca y colores</h2><ImageField label="Logo" value={quiz.identity.logoUrl} onChange={logoUrl=>set({identity:{...quiz.identity,logoUrl}})}/>
     {Object.entries({name:'Nombre de marca',color:'Color de botones',background:'Color de fondo',textColor:'Color de texto'}).map(([key,label])=><QField key={key} label={label} type={['color','background','textColor'].includes(key)?'color':'text'} value={quiz.identity[key]} onChange={value=>set({identity:{...quiz.identity,[key]:value}})}/>)}
     <details><summary>Enlaces y textos de navegación</summary>
      {Object.entries({backText:'Botón Atrás',skipText:'Botón Omitir',termsUrl:'Términos (URL)',privacyUrl:'Privacidad (URL)'}).map(([key,label])=><QField key={key} label={label} value={quiz.identity[key]} onChange={value=>set({identity:{...quiz.identity,[key]:value}})}/>)}</details>
    </div>}
    {tab==='Avanzado'&&<>
     <p className="qe-hint">Opcional. El quiz funciona sin nada de esto: son reglas, saltos, cálculos y perfiles para casos especiales.</p>
     <details className="qe-card"><summary>Reglas por pantalla (mostrar si…, saltos, textos según respuestas)</summary><div className="qe-stack">
      {quiz.steps.map((s,i)=><details className="qe-card" key={s.id}><summary>{i+1}. {s.title}</summary><StepForm step={s} quiz={quiz} index={i} onChange={patch=>setStep(i,patch)} onRemoveOption={optionId=>set(removeOption(quiz,s.id,optionId))}/></details>)}
     </div></details>
     <details className="qe-card"><summary>Cálculos y puntuaciones</summary><div className="qe-stack">
      {quiz.calculations.map((c,i)=><div className="qe-card" key={c.id}><QField label="Nombre del cálculo" value={c.label} onChange={label=>set({calculations:quiz.calculations.map((x,j)=>j===i?{...x,label}:x)})}/><Expression quiz={quiz} value={c.expression} onChange={expression=>set({calculations:quiz.calculations.map((x,j)=>j===i?{...x,expression}:x)})}/><Button variant="outline" onClick={()=>window.confirm(`¿Eliminar el cálculo "${c.label||c.id}"? Las reglas que lo usan dejan de cumplirse y las fórmulas lo toman como 0.`)&&set(removeCalculation(quiz,c.id))}>Eliminar cálculo</Button></div>)}
      <Button variant="outline" onClick={()=>set({calculations:[...quiz.calculations,{id:uid(),label:'Nuevo cálculo',expression:{op:'const',value:0}}]})}>Agregar cálculo</Button>
      <p className="qe-hint">Usá “Probar quiz” para comprobar los resultados con tus respuestas.</p>
     </div></details>
     <details className="qe-card"><summary>Perfiles y resultados condicionales</summary><div className="qe-stack">
      <p className="qe-hint">Se usa el primer perfil que coincide. El predeterminado cubre los demás casos.</p>
      {quiz.results.map((r,i)=><details className="qe-card" key={r.id}><summary>{r.title}{r.default?' · Predeterminado':''}</summary><div className="qe-stack">
       <Reorder list={quiz.results} index={i} onChange={results=>set({results})} copy={x=>({...x,default:false,title:`${x.title||'Perfil'} (copia)`,when:x.when||{mode:'all',conditions:[]}})} removable={!r.default}/>
       <Toggle label="Resultado predeterminado" value={r.default} onChange={v=>v&&set({results:quiz.results.map((x,j)=>({...x,default:i===j}))})}/>
       <CopyField quiz={quiz} label="Título del perfil" value={r.title} onChange={title=>set({results:quiz.results.map((x,j)=>j===i?{...x,title}:x)})}/>
       <CopyField quiz={quiz} label="Descripción del perfil" value={r.description} onChange={description=>set({results:quiz.results.map((x,j)=>j===i?{...x,description}:x)})}/>
       <QField label="Botón de compra del perfil" value={r.buttonText} onChange={buttonText=>set({results:quiz.results.map((x,j)=>j===i?{...x,buttonText}:x)})}/>
       {!r.default&&<Conditions quiz={quiz} value={r.when} onChange={when=>set({results:quiz.results.map((x,j)=>j===i?{...x,when}:x)})}/>}
       <Blocks quiz={quiz} value={r.blocks} onChange={blocks=>set({results:quiz.results.map((x,j)=>j===i?{...x,blocks}:x)})}/>
      </div></details>)}
      <Button variant="outline" onClick={()=>set({results:[...quiz.results,{id:uid(),title:'Nuevo perfil',default:false,blocks:[],when:{mode:'all',conditions:[]}}]})}>Agregar perfil</Button>
     </div></details>
     <details className="qe-card"><summary>Validación de la configuración</summary>{errors.length?<ul className="qe-errors">{errors.map(e=><li key={e}>{e}</li>)}</ul>:<p>Todo listo para probar y publicar.</p>}</details>
    </>}
   </fieldset></UploadContext.Provider>
  </>}
 </div></>;
}
export default function QuizEditor(){
 const {storeId}=useParams();const data=useQuery(api.quizzes.get,{storeId});
 const save=useMutation(api.quizzes.save),publish=useMutation(api.quizzes.publish),generate=useAction(api.quizWizard.generate),generateImage=useAction(api.quizImages.generate);
 const upload=useMediaUpload();
 if(data===undefined)return <PageSkeleton label="Cargando quiz"/>;if(!data)return <p>Tienda no disponible.</p>;
 return <QuizEditorForm key={storeId} backTo={`/panel/tiendas/${storeId}/landings`} initial={data.quiz} subdomain={data.subdomain} settingsPath={`/panel/tiendas/${storeId}/configuracion`} view={data.view} published={Boolean(data.landing?.publicationId)} exists={Boolean(data.landing)} onSave={args=>save({storeId,...args})} onPublish={()=>publish({storeId})} onGenerate={args=>generate({storeId,...args})} onGenerateImage={args=>generateImage({storeId,...args})} onUploadImage={upload} uploading={upload.pending}/>;
}

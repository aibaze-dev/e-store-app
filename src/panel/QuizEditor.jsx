import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/lib/api.js';
import { Button } from '@/components/ui/button';
import { PageSkeleton, ErrorAlert } from '@/components/Field.jsx';
import { errorText } from '@/lib/format.js';
import { QuizPreview } from '@/storefront/Quiz.jsx';
import { clone, validateQuiz } from '../../shared/quiz.js';
import QuizWizard from './QuizWizard.jsx';
import QuizBuilder, { UploadContext } from './QuizBuilder.jsx';
import { Blocks, CopyField, Conditions, Expression, Reorder, StepForm, Toggle, uid } from './QuizAdvanced.jsx';
import { QField } from './QuizFields.jsx';
import './quiz-editor.css';
export { QField } from './QuizFields.jsx';

export function QuizEditorForm({initial,subdomain:address,view,onSave,onPublish,onGenerate,onGenerateImage,onUploadImage,published}) {
 const [quiz,setQuiz]=useState(()=>clone(initial)),[subdomain,setSubdomain]=useState(address),[tab,setTab]=useState('Contenido');
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false),[aiOpen,setAiOpen]=useState(true),[dirty,setDirty]=useState(false);
 const set=patch=>{setQuiz(q=>({...q,...patch}));setDirty(true);setStatus('');};
 const errors=validateQuiz(quiz,true);
 const task=async(fn,message)=>{setBusy(true);setError('');setStatus('');try{await fn();setStatus(message);}catch(e){setError(errorText(e,'No se pudo completar la operación.'));}finally{setBusy(false);}};
 const publish=()=>{if(errors.length){setError(errors.join('\n'));return;}task(async()=>{await onSave({quiz:clone(quiz),subdomain});await onPublish();setDirty(false);},'Quiz publicado.');};
 const setStep=(index,patch)=>set({steps:quiz.steps.map((s,i)=>i===index?{...s,...patch}:s)});
 const mainResult=quiz.results.find(r=>r.default);
 const setResult=patch=>set({results:quiz.results.map(r=>r.id===mainResult.id?{...r,...patch}:r)});
 return <div className="quiz-editor qe-simple-editor">
  <header className="qe-heading"><div><p className="qe-eyebrow">Landings / Quiz</p><h1>Tu quiz</h1><p>Ordená las pantallas, editá cada una y mirá cómo se ve al lado.</p></div><span className="qe-status">{published?'Publicado':'Borrador'}{dirty?' · Cambios sin guardar':''}</span></header>
  {!preview&&<QuizWizard open={aiOpen} onOpenChange={setAiOpen} quiz={quiz} view={view} disabled={busy} onGenerate={onGenerate} onGenerateImage={onGenerateImage} onBusy={setBusy} onApply={async proposal=>{
    await onSave({quiz:clone(proposal),subdomain});setQuiz(proposal);setDirty(false);setStatus('Quiz generado y guardado como borrador. Ya podés probarlo.');
   }}/>}
  {(!aiOpen||preview)&&<div className="qe-toolbar">
   <Button variant="outline" disabled={busy} onClick={()=>task(async()=>{await onSave({quiz:clone(quiz),subdomain});setDirty(false);},'Borrador guardado.')}>Guardar borrador</Button>
   <Button variant="outline" disabled={busy} onClick={()=>{if(errors.length){setError(errors.join('\n'));}else setPreview(!preview);}}>{preview?'Volver a editar':'Probar quiz'}</Button>
   <Button disabled={busy} onClick={publish}>{busy?'Guardando…':'Publicar quiz'}</Button>
  </div>}
  <ErrorAlert>{error}</ErrorAlert>{status&&<p role="status">{status}</p>}
  {!address&&<div className="qe-card"><QField label="Dirección de tu tienda" value={subdomain} onChange={value=>{setSubdomain(value);setDirty(true);}}/><p className="qe-hint">Elegí un subdominio para guardar y publicar. Se comparte con la landing clásica.</p></div>}
  {preview?<QuizPreview key={JSON.stringify(quiz)} quiz={quiz} view={view}/>:!aiOpen&&<>
   <nav className="qe-tabs" aria-label="Apartados del editor">{['Contenido','Diseño','Avanzado'].map(name=><button disabled={busy} key={name} onClick={()=>setTab(name)} aria-current={tab===name?'page':undefined}>{name}</button>)}</nav>
   <UploadContext.Provider value={onUploadImage}><fieldset disabled={busy} className="qe-main qe-stack">
    {tab==='Contenido'&&<QuizBuilder quiz={quiz} view={view} set={set}/>}
    {tab==='Diseño'&&<div className="qe-card qe-stack"><h2>Marca y colores</h2>
     {Object.entries({name:'Nombre de marca',logoUrl:'Logo (URL)',color:'Color de botones',background:'Color de fondo',textColor:'Color de texto'}).map(([key,label])=><QField key={key} label={label} type={['color','background','textColor'].includes(key)?'color':'text'} value={quiz.identity[key]} onChange={value=>set({identity:{...quiz.identity,[key]:value}})}/>)}
     <details><summary>Enlaces, dirección y textos de navegación</summary>
      <QField label="Subdominio compartido de la tienda" value={subdomain} onChange={v=>{setSubdomain(v);setDirty(true);}}/>
      <p className="qe-hint">Cambiarlo actualiza la dirección de ambas landings.</p>
      {Object.entries({backText:'Botón Atrás',skipText:'Botón Omitir',termsUrl:'Términos (URL)',privacyUrl:'Privacidad (URL)'}).map(([key,label])=><QField key={key} label={label} value={quiz.identity[key]} onChange={value=>set({identity:{...quiz.identity,[key]:value}})}/>)}</details>
    </div>}
    {tab==='Avanzado'&&<>
     <p className="qe-hint">Opcional. El quiz funciona sin nada de esto: son reglas, saltos, cálculos y perfiles para casos especiales.</p>
     <details className="qe-card"><summary>Reglas por pantalla (mostrar si…, saltos, textos según respuestas)</summary><div className="qe-stack">
      {quiz.steps.map((s,i)=><details className="qe-card" key={s.id}><summary>{i+1}. {s.title}</summary><StepForm step={s} quiz={quiz} index={i} onChange={patch=>setStep(i,patch)}/></details>)}
     </div></details>
     <details className="qe-card"><summary>Cálculos y puntuaciones</summary><div className="qe-stack">
      {quiz.calculations.map((c,i)=><div className="qe-card" key={c.id}><QField label="Nombre del cálculo" value={c.label} onChange={label=>set({calculations:quiz.calculations.map((x,j)=>j===i?{...x,label}:x)})}/><Expression quiz={quiz} value={c.expression} onChange={expression=>set({calculations:quiz.calculations.map((x,j)=>j===i?{...x,expression}:x)})}/><Button variant="outline" onClick={()=>set({calculations:quiz.calculations.filter((_,j)=>j!==i)})}>Eliminar cálculo</Button></div>)}
      <Button variant="outline" onClick={()=>set({calculations:[...quiz.calculations,{id:uid(),label:'Nuevo cálculo',expression:{op:'const',value:0}}]})}>Agregar cálculo</Button>
      <p className="qe-hint">Usá “Probar quiz” para comprobar los resultados con tus respuestas.</p>
     </div></details>
     <details className="qe-card"><summary>Perfiles y resultados condicionales</summary><div className="qe-stack">
      <p className="qe-hint">Se usa el primer perfil que coincide. El predeterminado cubre los demás casos.</p>
      {quiz.results.map((r,i)=><details className="qe-card" key={r.id}><summary>{r.title}{r.default?' · Predeterminado':''}</summary><div className="qe-stack">
       <Reorder list={quiz.results} index={i} onChange={results=>set({results})}/>
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
 </div>;
}
export default function QuizEditor(){
 const {storeId}=useParams();const data=useQuery(api.quizzes.get,{storeId});
 const save=useMutation(api.quizzes.save),publish=useMutation(api.quizzes.publish),generate=useAction(api.quizWizard.generate),generateImage=useAction(api.quizImages.generate);
 const uploadUrl=useMutation(api.quizzes.imageUploadUrl),imageUrl=useMutation(api.quizzes.imageUrl);
 // Uploads straight to Convex storage; the server checks type and size before returning the URL.
 async function upload(file){
  try{const url=await uploadUrl();const response=await fetch(url,{method:'POST',headers:{'Content-Type':file.type},body:file});if(!response.ok)throw new Error('upload');const {storageId}=await response.json();var result=await imageUrl({storageId});}
  catch(e){throw new Error(errorText(e,'No se pudo subir la imagen. Volvé a intentar.'));}
  if(result.error)throw new Error(result.error);return result.url;
 }
 if(data===undefined)return <PageSkeleton label="Cargando quiz"/>;if(!data)return <p>Tienda no disponible.</p>;
 return <><Link to={`/panel/tiendas/${storeId}/landings`}>← Landings</Link><QuizEditorForm key={storeId} initial={data.quiz} subdomain={data.subdomain} view={data.view} published={Boolean(data.landing?.publicationId)} onSave={args=>save({storeId,...args})} onPublish={()=>publish({storeId})} onGenerate={args=>generate({storeId,...args})} onGenerateImage={args=>generateImage({storeId,...args})} onUploadImage={upload}/></>;
}

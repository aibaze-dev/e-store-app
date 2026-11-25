import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@/lib/api.js';
import { Button } from '@/components/ui/button';
import { ErrorAlert, PageSkeleton } from '@/components/Field.jsx';
import { errorText, formatMoney } from '@/lib/format.js';
import { contextFor, displayRef } from '../../shared/quiz.js';
import './quiz-editor.css';
const date=at=>at?new Date(at).toLocaleString('es'):'—';
function Detail({id,onClose}){const data=useQuery(api.quizzes.detail,{sessionId:id}),remove=useMutation(api.quizzes.remove);const [confirm,setConfirm]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);if(data===undefined)return <PageSkeleton label="Cargando respuestas"/>;if(!data)return <p>Este registro fue eliminado.</p>;const context=contextFor(data.quiz,data.answers);return <section className="qe-card qe-stack qe-session"><div className="qe-actions"><Button variant="outline" onClick={onClose}>Cerrar detalle</Button><Button variant="outline" onClick={()=>setConfirm(!confirm)}>Eliminar registro</Button></div>{confirm&&<div><p>Se eliminarán las respuestas y los datos de contacto de esta sesión. Las compras conservan su historial de cobro y origen.</p><Button disabled={busy} onClick={async()=>{setBusy(true);try{await remove({sessionId:id});onClose();}catch(e){setError(errorText(e,'No se pudo eliminar.'));}finally{setBusy(false);}}}>Confirmar eliminación</Button></div>}<ErrorAlert>{error}</ErrorAlert><h2>{data.contact?.name||'Sesión sin nombre'}</h2><p>{data.contact?.email||'Sin email'} · {date(data._creationTime)}</p><p>Perfil: {data.quiz.results.find(r=>r.id===data.resultId)?.title||'Sin finalizar'}</p><p>Consentimiento: {data.consent?.accepted?'Aceptado':'No aceptado'} · {date(data.consent?.at)}</p>{data.consent&&<p>{data.consent.text}</p>}<p className="qe-hint">Publicación: {data.publicationId}</p><h3>Respuestas</h3><dl>{data.quiz.steps.filter(s=>data.answers[s.id]!=null&&s.type!=='contact').map(s=><div key={s.id}><dt>{s.title}</dt><dd className="font-semibold mb-3">{displayRef(`answer:${s.id}`,context)}</dd></div>)}</dl><h3>Cálculos</h3><dl>{data.quiz.calculations.map(c=><div key={c.id}><dt>{c.label}</dt><dd>{displayRef(`calc:${c.id}`,context)}</dd></div>)}</dl><h3>Compras vinculadas</h3>{data.orders.length?data.orders.map(o=><p key={o._id}>{o.status} · {formatMoney(o.total,o.currency)} · {date(o._creationTime)}</p>):<p>Sin compras.</p>}</section>;}

const number = new Intl.NumberFormat('es-AR');
const percent = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 });

function Stage({ label, count, total, color = 'var(--chart-1)' }) {
  const share = total ? count / total : 0;
  return <li className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2">
    <span className="text-sm font-medium [overflow-wrap:anywhere]">{label}</span>
    <span className="flex items-baseline gap-3 whitespace-nowrap tabular-nums">
      <strong>{number.format(count)}</strong>
      <span className="min-w-14 text-right text-xs text-muted-foreground">{total ? percent.format(share) : '—'}</span>
    </span>
    <div className="col-span-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: share * 100 + '%', backgroundColor: color }} />
    </div>
  </li>;
}

function QuizFunnel({ funnel }) {
  const { started, finalPage, checkout, screens, publicationSessions, estimatedFinal } = funnel;
  return <>
    <section className="qe-card qe-stack" aria-labelledby="quiz-funnel">
      <div><h2 id="quiz-funnel">Embudo del quiz</h2>
        <p className="text-sm text-muted-foreground">Sesiones de todas las versiones · Porcentaje sobre los inicios</p>
      </div>
      {started > 0 ? <>
        <ol className="grid gap-5">
          <Stage label="Iniciaron el quiz" count={started} total={started} />
          <Stage label="Llegaron a la página final" count={finalPage} total={started} />
          <Stage label="Pasaron al checkout" count={checkout} total={started} />
        </ol>
        {finalPage > 0 && <p className="border-t pt-4 text-sm">
          El <strong>{percent.format(checkout / finalPage)}</strong> de las sesiones que llegaron a la página final pasó al checkout.
        </p>}
        {estimatedFinal > 0 && <p className="qe-hint">El total de la página final incluye {number.format(estimatedFinal)} {estimatedFinal === 1 ? 'sesión anterior estimada' : 'sesiones anteriores estimadas'} a partir de la última respuesta.</p>}
      </> : <p className="text-sm text-muted-foreground">El embudo aparecerá cuando alguien inicie el quiz.</p>}
    </section>
    {screens.length > 0 && <section className="qe-card qe-stack" aria-labelledby="quiz-screens">
      <div><h2 id="quiz-screens">Avance por pantalla</h2>
        <p className="text-sm text-muted-foreground">Sesiones que completaron cada pantalla de la última versión publicada
          {' '}(sobre {number.format(publicationSessions)}). Las respuestas pueden llevar a distintas pantallas.</p>
      </div>
      {publicationSessions ? <ol className="grid gap-4">
        {screens.map((screen, i) => <Stage key={screen.id} label={`${i + 1}. ${screen.title}`} count={screen.count} total={publicationSessions} color="var(--chart-2)" />)}
      </ol> : <p className="qe-hint">Todavía no hay sesiones en esta versión.</p>}
    </section>}
  </>;
}

function StoreContacts({ storeId }) {
  const [cursor, setCursor] = useState(null), [id, setId] = useState(null);
  const list = useQuery(api.quizzes.sessions, { storeId, cursor });
  const report = useAction(api.quizzes.funnel);
  const [funnel, setFunnel] = useState(null), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    report({ storeId }).then(
      value => { if (active) setFunnel(value); },
      e => { if (active) setError(errorText(e, 'No se pudo cargar la medición.')); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, report, refresh]);

  return <div className="quiz-editor qe-stack qe-session">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Contactos y respuestas</h1>
        {funnel && <p className="qe-hint">Medición al {date(funnel.asOf)}</p>}
      </div>
      <Button variant="outline" disabled={loading} onClick={() => setRefresh(n => n + 1)}>
        {loading ? 'Actualizando…' : error ? 'Reintentar medición' : 'Actualizar medición'}
      </Button>
    </header>
    <ErrorAlert>{error}</ErrorAlert>
    {funnel ? <QuizFunnel funnel={funnel} /> : loading && <PageSkeleton label="Cargando embudo" />}
    {id ? <Detail key={id} id={id} onClose={() => setId(null)} /> :
      <section className="qe-card qe-stack">
        <div><h2>Historial de sesiones</h2>
          {funnel && <p className="text-sm text-muted-foreground">Sesiones con datos de contacto · {number.format(funnel.contacts)}</p>}
        </div>
        {!list ? <PageSkeleton label="Cargando sesiones" /> : <>
          {list.page.length === 0 && <p>Todavía no hay respuestas.</p>}
          {list.page.map(s => <button className="qe-card text-left" key={s._id} onClick={() => setId(s._id)}>
            <strong>{s.contact?.name || s.contact?.email || 'Visitante sin contacto'}</strong>
            <p>{date(s._creationTime)} · {s.completedAt ? 'Finalizado' : `${s.history.length} pasos completados`}</p>
          </button>)}
          {(cursor || !list.isDone) && <div className="qe-actions">
            <Button variant="outline" disabled={!cursor} onClick={() => setCursor(null)}>Primera página</Button>
            <Button variant="outline" disabled={list.isDone} onClick={() => setCursor(list.continueCursor)}>Siguiente página</Button>
          </div>}
        </>}
      </section>}
  </div>;
}

export default function QuizContacts() {
  const { storeId } = useParams();
  return <StoreContacts key={storeId} storeId={storeId} />;
}

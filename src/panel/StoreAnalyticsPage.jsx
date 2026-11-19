import { useEffect, useState } from 'react';
import { useAction, useConvexAuth } from 'convex/react';
import { BarChart3, RefreshCw } from 'lucide-react';
import LiveAnalytics from './LiveAnalytics.jsx';
import AnalyticsCharts from './AnalyticsCharts.jsx';
import { api } from '@/lib/api.js';
import { errorText, formatDate } from '@/lib/format.js';
import business from '@/config/businessData.json';
import { dateKey, shiftDate, validRange } from '../../shared/analytics.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';
import { useStoreWorkspace } from './StoreWorkspace.jsx';

const number = value => new Intl.NumberFormat(business.locale).format(value);
function presetRange(days) {
  const to = dateKey(Date.now(), business.timeZone);
  return { from: shiftDate(to, 1 - days), to };
}

export function AnalyticsResults({ data }) {
  const { total } = data;
  const count = (uniques, views) => views > 0 && uniques === 0 ? '—' : number(uniques);
  const cards = [
    { label: 'Personas en tu tienda', value: count(total.uniques, total.views), note: 'Total del período, sin repetir entre páginas ni días' },
    { label: 'Vieron la landing', value: count(total.landingUniques, total.landingViews), note: 'Personas que llegaron a tu oferta' },
    { label: 'Llegaron al checkout', value: count(total.checkoutUniques, total.checkoutViews), note: 'Personas que abrieron el checkout' },
    { label: 'Compras pagadas', value: total.purchases === undefined ? '—' : number(total.purchases), note: 'Pagos confirmados, incluidas las ofertas post-compra', purchases: true },
  ];
  return <div className="space-y-6">
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Visitas y compras en el período seleccionado</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <section key={card.label} className={`dashboard-card space-y-3 p-5 ${card.purchases ? 'order-status order-summary' : ''}`} data-order-status={card.purchases ? 'paid' : undefined}>
        <h2 className="text-sm font-medium text-muted-foreground">{card.label}</h2>
        <p className={`text-3xl font-semibold tabular-nums ${card.purchases ? 'order-amount' : ''}`}>{card.value}</p>
        <p className="text-xs leading-5 text-muted-foreground">{card.note}</p>
      </section>)}</div>
    </div>
    {total.unknownIpViews > 0 && total.uniques > 0 && <p className="rounded-xl border bg-card p-4 text-sm leading-6">Hay actividad que no pudimos incluir en la estimación de personas.</p>}
    {total.views === 0 ? <EmptyState title="No hay visitas registradas en este período">
      <p>El historial de visitas empieza cuando se activa esta medición. Las compras se muestran aunque no haya visitas registradas.</p>
    </EmptyState> : total.uniques === 0 ? <EmptyState title="Todavía no podemos estimar cuántas personas llegaron">
      <p>Hay actividad registrada, pero falta información para distinguir a los visitantes.</p>
    </EmptyState> : null}
    {(total.views > 0 || total.purchases > 0) && <>
      <AnalyticsCharts data={data} />
      <section className="dashboard-card p-5 sm:p-6" aria-label="Detalle diario de personas y compras">
        <details><summary className="cursor-pointer text-sm font-medium">Ver personas y compras por día</summary>
          <div className="mt-4 max-h-96 overflow-auto"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>En la tienda</TableHead><TableHead>En la landing</TableHead><TableHead>En el checkout</TableHead><TableHead>Compras pagadas</TableHead></TableRow></TableHeader>
            <TableBody>{data.days.map(day => <TableRow key={day.day}><TableCell className="whitespace-nowrap">{day.day}</TableCell><TableCell>{count(day.uniques, day.views)}</TableCell><TableCell>{count(day.landingUniques, day.landingViews)}</TableCell><TableCell>{count(day.checkoutUniques, day.checkoutViews)}</TableCell><TableCell className="font-semibold text-[var(--order-paid)]">{day.purchases === undefined ? '—' : number(day.purchases)}</TableCell></TableRow>)}</TableBody>
          </Table></div>
        </details>
      </section>
    </>}
    <div className="space-y-2 text-xs leading-6 text-muted-foreground">
      <details><summary className="w-fit cursor-pointer">Cómo estimamos las personas</summary>
        <p className="mt-2 max-w-3xl">Usamos la IP para reconocer visitantes sin contar sus recargas. Es una aproximación: varias personas pueden compartir una IP y una persona puede cambiar de conexión. El total del período cuenta cada identificador una sola vez, aunque aparezca en varios días o páginas.</p>
      </details>
      <p>Actualizado: {formatDate(data.asOf)}.</p>
    </div>
  </div>;
}

export default function StoreAnalyticsPage() {
  const { store } = useStoreWorkspace();
  const { isAuthenticated } = useConvexAuth();
  const report = useAction(api.analytics.report);
  const [range, setRange] = useState(() => presetRange(7));
  const [draft, setDraft] = useState(range);
  const [preset, setPreset] = useState('7');
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const valid = validRange(draft.from, draft.to);
  useEffect(() => {
    if (!isAuthenticated || !store) return;
    let active = true;
    setState({ loading: true, data: null, error: '' });
    report({ storeId: store._id, ...range }).then(data => {
      if (active) setState({ loading: false, data, error: '' });
    }).catch(error => {
      if (active) setState({ loading: false, data: null, error: errorText(error, 'No se pudieron cargar las analíticas. Volvé a intentar.') });
    });
    return () => { active = false; };
  }, [store?._id, isAuthenticated, report, range.from, range.to, refresh]);
  if (!store) return <EmptyState title="Seleccioná una tienda para ver sus analíticas" />;
  return <div className="space-y-6">
    <div className="space-y-2"><p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase"><BarChart3 className="size-4" aria-hidden="true" />{store.name}</p><h1 className="text-3xl font-semibold tracking-tight">Analíticas</h1></div>
    {isAuthenticated && <LiveAnalytics key={store._id} storeId={store._id} />}
    <form className="dashboard-card space-y-4 p-5" onSubmit={event => { event.preventDefault(); if (valid) { setRange(draft); setRefresh(value => value + 1); } }}>
      <h2 className="text-lg font-semibold tracking-tight">Informe por período</h2>
      <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Período">{props => <NativeSelect {...props} value={preset} onChange={event => {
          const value = event.target.value; setPreset(value);
          if (value !== 'custom') { const next = presetRange(Number(value)); setDraft(next); setRange(next); }
        }}><option value="1">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="custom">Personalizado</option></NativeSelect>}</Field>
        <Field label="Desde">{props => <Input {...props} type="date" required value={draft.from} onChange={event => { setPreset('custom'); setDraft({ ...draft, from: event.target.value }); }} />}</Field>
        <Field label="Hasta">{props => <Input {...props} type="date" required value={draft.to} onChange={event => { setPreset('custom'); setDraft({ ...draft, to: event.target.value }); }} />}</Field>
        <Button type="submit" className="h-11" disabled={!valid || state.loading}><RefreshCw className={state.loading ? 'animate-spin' : ''} aria-hidden="true" />{state.loading ? 'Cargando…' : 'Actualizar'}</Button>
      </div>
      {!valid && <p role="alert" className="text-sm text-destructive">Elegí fechas válidas, en orden, con un máximo de 366 días.</p>}
    </form>
    {state.loading ? <PageSkeleton label="Calculando visitas y compras" /> : state.error ? <div className="space-y-4"><ErrorAlert>{state.error}</ErrorAlert><Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Volver a intentar</Button></div> : state.data && <AnalyticsResults data={state.data} />}
  </div>;
}

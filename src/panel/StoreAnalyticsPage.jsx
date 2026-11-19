import { useEffect, useState } from 'react';
import { useAction, useConvexAuth } from 'convex/react';
import { BarChart3, CalendarDays, RefreshCw } from 'lucide-react';
import LiveAnalytics from './LiveAnalytics.jsx';
import PeriodAnalytics from './PeriodAnalytics.jsx';
import AnalyticsCharts from './AnalyticsCharts.jsx';
import CampaignAnalytics from './CampaignAnalytics.jsx';
import { api } from '@/lib/api.js';
import { errorText, formatDate } from '@/lib/format.js';
import business from '@/config/businessData.json';
import { dateKey, shiftDate, validRange } from '../../shared/analytics.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorAlert, Field, PageSkeleton } from '@/components/Field.jsx';
import { useStoreWorkspace } from './StoreWorkspace.jsx';

const number = value => new Intl.NumberFormat(business.locale).format(value);
function presetRange(days) {
  const to = dateKey(Date.now(), business.timeZone);
  return { from: shiftDate(to, 1 - days), to };
}

export function AnalyticsResults({ data, currency }) {
  const { total } = data;
  const count = (uniques, views) => views > 0 && uniques === 0 ? '—' : number(uniques);
  const cards = [
    { label: 'Personas en tu tienda', value: count(total.uniques, total.views), note: 'Total del período, sin repetir entre páginas ni días' },
    { label: 'Vieron la landing', value: count(total.landingUniques, total.landingViews), note: 'Personas que llegaron a tu oferta' },
    { label: 'Llegaron al checkout', value: count(total.checkoutUniques, total.checkoutViews), note: 'Personas que abrieron el checkout' },
  ];
  return <div className="space-y-6">
    <PeriodAnalytics data={data} currency={currency} />
    <CampaignAnalytics sources={data.sources} currency={currency} />
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Audiencia del período</h2>
      <div className="grid gap-4 sm:grid-cols-3">{cards.map(card => <section key={card.label} className="dashboard-card space-y-2 p-5">
        <h3 className="text-sm font-medium text-muted-foreground">{card.label}</h3>
        <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
        <p className="text-xs leading-5 text-muted-foreground">{card.note}</p>
      </section>)}</div>
    </div>
    {total.unknownIpViews > 0 && total.uniques > 0 && <p className="rounded-xl border bg-card p-4 text-sm leading-6">Hay actividad que no pudimos incluir en la estimación de personas.</p>}
    {total.views === 0 ? <EmptyState title="No hay visitas registradas en este período">
      <p>El historial de visitas empieza cuando se activa esta medición. Las compras se muestran aunque no haya visitas registradas.</p>
    </EmptyState> : total.uniques === 0 ? <EmptyState title="Todavía no podemos estimar cuántas personas llegaron">
      <p>Hay actividad registrada, pero falta información para distinguir a los visitantes.</p>
    </EmptyState> : null}
    {data.days && (total.views > 0 || total.purchases > 0) && <>
      <details className="dashboard-card p-5"><summary className="cursor-pointer text-sm font-medium">Ver evolución diaria de la audiencia</summary><div className="mt-4"><AnalyticsCharts data={data} /></div></details>
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
      <p>Ventas y facturación incluyen las ofertas post-compra. Los importes se agrupan por moneda y fecha de pago confirmado.</p>
    </div>
  </div>;
}

const periods = [
  ['12h', 'Últimas 12 horas'], ['1', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['custom', 'Personalizado'],
];

function PeriodReport({ store, preset, from, to }) {
  const daily = useAction(api.analytics.report);
  const rolling = useAction(api.analytics.rollingActivity);
  const [result, setResult] = useState({ data: null, error: '' });
  const [retry, setRetry] = useState(0);
  const hourly = preset === '12h';
  useEffect(() => {
    let active = true;
    let pending = false;
    async function load() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const range = preset === 'custom' ? { from, to } : hourly ? null : presetRange(Number(preset));
        const singleDay = range && range.from === range.to;
        const data = hourly || singleDay
          ? await rolling({ storeId: store._id, ...(singleDay ? { day: range.from } : {}) })
          : await daily({ storeId: store._id, ...range });
        if (active) setResult({ data, error: '' });
      } catch (error) {
        if (active) setResult({ data: null, error: errorText(error, 'No se pudieron cargar las analíticas del período.') });
      } finally {
        pending = false;
      }
    }
    load();
    const timer = hourly || preset === '1' ? window.setInterval(load, 60_000) : undefined;
    document.addEventListener('visibilitychange', load);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [daily, rolling, store._id, hourly, preset, from, to, retry]);
  const { data, error } = result;
  return <>
    {hourly && <LiveAnalytics storeId={store._id} />}
    {error ? <div className="space-y-3"><ErrorAlert>{error}</ErrorAlert><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Volver a intentar</Button></div>
      : data ? <>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{hourly ? 'Últimas 12 horas' : data.day ?? (data.days[0].day + ' — ' + data.days.at(-1).day)}</h2>
          <p className="text-xs text-muted-foreground">Actualizado {formatDate(data.asOf)} · {business.timeZone}</p>
        </div>
        <AnalyticsResults data={data} currency={store.currency} />
      </> : <PageSkeleton label="Calculando las métricas del período" />}
  </>;
}

export default function StoreAnalyticsPage() {
  const { store } = useStoreWorkspace();
  const { isAuthenticated } = useConvexAuth();
  const [preset, setPreset] = useState('12h');
  const [custom, setCustom] = useState(() => presetRange(7));
  const [refresh, setRefresh] = useState(0);
  const historical = preset === 'custom';
  const valid = !historical || validRange(custom.from, custom.to);
  const from = historical ? custom.from : undefined;
  const to = historical ? custom.to : undefined;
  if (!store) return <EmptyState title="Seleccioná una tienda para ver sus analíticas" />;
  return <div className="space-y-5">
    <header className="space-y-2"><p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase"><BarChart3 className="size-4" aria-hidden="true" />{store.name}</p><h1 className="text-3xl font-semibold tracking-tight">Analíticas</h1></header>
    <section aria-label="Seleccionar período" className="dashboard-card space-y-4 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={17} aria-hidden="true" />Período</span>
        <div role="group" aria-label="Período del informe" className="flex max-w-full flex-wrap gap-1">{periods.map(([key, label]) =>
          <Button key={key} variant={preset === key ? 'secondary' : 'ghost'} aria-pressed={preset === key} className="h-11 px-3 text-xs" onClick={() => setPreset(key)}>{label}</Button>
        )}</div>
        <Button className="ms-auto h-11" variant="ghost" disabled={!valid} onClick={() => setRefresh(value => value + 1)} aria-label="Actualizar período"><RefreshCw size={16} aria-hidden="true" /></Button>
      </div>
      {historical && <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
        <Field label="Desde">{props => <Input {...props} type="date" required value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} />}</Field>
        <Field label="Hasta">{props => <Input {...props} type="date" required value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} />}</Field>
      </div>}
      {!valid && <p role="alert" className="text-sm text-destructive">Elegí fechas válidas, en orden, con un máximo de 366 días.</p>}
    </section>
    {valid && (isAuthenticated ? <PeriodReport key={[store._id, preset, from, to, refresh].join('/')} store={store} preset={preset} from={from} to={to} /> : <PageSkeleton label="Conectando con las analíticas" />)}
  </div>;
}

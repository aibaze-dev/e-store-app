import { useEffect, useState } from 'react';
import { useConvex, useConvexConnectionState } from 'convex/react';
import { Clock3, PanelsTopLeft, ShoppingBag, Store } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api.js';
import business from '@/config/businessData.json';
import { PRESENCE_REFRESH_MS, PRESENCE_WINDOW_MS } from '../../shared/analytics.js';

const number = new Intl.NumberFormat(business.locale);
const clock = new Intl.DateTimeFormat('es-AR', { timeZone: business.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const locations = [
  { key: 'landing', label: 'Landing y quiz', icon: PanelsTopLeft },
  { key: 'checkout', label: 'Checkout', icon: ShoppingBag },
];
const series = [
  { key: 'visits', label: 'Visitas', color: 'var(--chart-2)' },
  { key: 'purchases', label: 'Compras pagadas', color: 'var(--order-paid)', dash: '6 3' },
];
const getPresence = (client, storeId) => client.query(api.analytics.liveSessions, { storeId, sample: Date.now() });
const getActivity = (client, storeId) => client.action(api.analytics.rollingActivity, { storeId });

function useLiveSample(storeId, read, interval) {
  const client = useConvex();
  const { isWebSocketConnected } = useConvexConnectionState();
  const [state, setState] = useState({ status: 'Conectando', data: null });
  useEffect(() => {
    if (!isWebSocketConnected) {
      setState({ status: 'Sin conexión', data: null });
      return;
    }
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const data = await read(client, storeId);
        if (active) setState({ status: 'Live', data });
      } catch {
        if (active) setState({ status: 'Reintentando', data: null });
      } finally {
        pending = false;
      }
    };
    refresh();
    const timer = window.setInterval(refresh, interval);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [storeId, client, isWebSocketConnected, read, interval]);
  return state;
}

function Presence({ data, status }) {
  const landingShare = data?.total ? 100 * data.landing / data.total : 0;
  return <section className="presence-board" aria-labelledby="presence-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="presence-heading" className="text-lg font-semibold tracking-tight">Actividad en vivo</h2>
      <Badge variant="outline" className="presence-badge" data-live={status === 'Live'} role="status">
        <span aria-hidden="true" />{status}
      </Badge>
    </div>
    <div className="presence-grid">
      <div className="presence-total">
        <div aria-hidden="true" className="presence-ring" data-active={Boolean(data?.total)} style={{ '--landing-share': landingShare + '%' }}><Store size={22} /></div>
        <div><p className="presence-number">{data ? number.format(data.total) : '—'}</p><p className="presence-caption">Sesiones en la tienda</p></div>
      </div>
      {locations.map(({ key, label, icon: Icon }) => {
        const share = data?.total ? data[key] / data.total * 100 : 0;
        return <div key={key} className={'presence-stage stage-' + key}>
          <div className="flex items-center gap-2"><Icon size={16} aria-hidden="true" /><h3 className="text-sm font-medium">{label}</h3></div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <strong className="presence-stage-number">{data ? number.format(data[key]) : '—'}</strong>
            {data?.total > 0 && <span className="presence-caption text-xs">{Math.round(share)}%</span>}
          </div>
          <div className="presence-track" aria-hidden="true"><span style={{ width: share + '%' }} /></div>
        </div>;
      })}
    </div>
    <p className="presence-foot"><Clock3 size={13} aria-hidden="true" />Actividad en los últimos {PRESENCE_WINDOW_MS / 1000} s · Se actualiza cada {PRESENCE_REFRESH_MS / 1000} s</p>
  </section>;
}

function HourTooltip({ active, payload }) {
  const hour = payload?.[0]?.payload;
  if (!active || !hour) return null;
  return <div className="rounded-xl border bg-popover px-4 py-3 text-xs text-popover-foreground shadow-lg">
    <p className="mb-2 font-medium">{clock.format(hour.start)} – {clock.format(hour.end)}</p>
    {series.map(item => <div key={item.key} className="flex items-center justify-between gap-5 py-1"><span>{item.label}</span><strong className="tabular-nums">{number.format(hour[item.key])}</strong></div>)}
  </div>;
}

function ActivityChart({ data, status }) {
  return <section className="dashboard-card overflow-hidden" aria-labelledby="hourly-heading">
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b p-5 sm:px-6">
      <div><p className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Clock3 size={14} aria-hidden="true" />Últimas 12 horas</p>
        <h2 id="hourly-heading" className="text-xl font-semibold tracking-tight">Visitas y compras</h2>
      </div>
      <dl className="flex flex-wrap gap-6">{series.map(({ key, label, color, dash }) => <div key={key}>
        <dt className="flex items-center gap-2 text-xs text-muted-foreground"><i aria-hidden="true" className="w-5 border-t-[3px]" style={{ borderColor: color, borderStyle: dash ? 'dashed' : 'solid' }} />{label}</dt>
        <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{data ? number.format(data.hours.reduce((sum, hour) => sum + hour[key], 0)) : '—'}</dd>
      </div>)}</dl>
    </div>
    {data ? <>
      <div className="px-2 pt-5 sm:px-4">
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <LineChart data={data.hours} margin={{ top: 8, right: 20, bottom: 8, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis dataKey="end" tickFormatter={at => clock.format(at)} axisLine={false} tickLine={false} tickMargin={10} minTickGap={24} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <YAxis width={44} allowDecimals={false} domain={[0, max => Math.max(1, max)]} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <Tooltip content={<HourTooltip />} cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 4' }} />
            {series.map(item => <Line key={item.key} dataKey={item.key} name={item.label} type="linear" stroke={item.color} strokeWidth={item.dash ? 2 : 3} strokeDasharray={item.dash} dot={{ r: item.dash ? 2 : 3, fill: 'var(--card)' }} activeDot={{ r: 5 }} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-xs text-muted-foreground sm:px-6">
        <p>{data.hours.some(h => h.visits || h.purchases) ? 'Visitas registradas y pagos confirmados por hora.' : 'Todavía no hubo visitas ni compras en estas 12 horas.'}</p>
        <p>Actualizado a las {clock.format(data.asOf)} · {business.timeZone}</p>
      </div>
    </> : <p role="status" className="grid min-h-56 place-items-center p-6 text-center text-sm text-muted-foreground">{status === 'Reintentando' ? 'No se pudo cargar el gráfico. Se volverá a intentar en un minuto.' : status === 'Sin conexión' ? 'Esperando conexión para actualizar el gráfico…' : 'Cargando las últimas 12 horas…'}</p>}
  </section>;
}

export default function LiveAnalytics({ storeId }) {
  const presence = useLiveSample(storeId, getPresence, PRESENCE_REFRESH_MS);
  const activity = useLiveSample(storeId, getActivity, 60_000);
  return <><Presence {...presence} /><ActivityChart {...activity} /></>;
}

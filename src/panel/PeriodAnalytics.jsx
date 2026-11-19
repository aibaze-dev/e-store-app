import { Banknote, ListFilter, ShoppingBag, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/format.js';
import business from '@/config/businessData.json';

const number = new Intl.NumberFormat(business.locale);
const percent = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 });
const clock = new Intl.DateTimeFormat('es-AR', { timeZone: business.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const axis = { axisLine: false, tickLine: false, tick: { fill: 'var(--muted-foreground)', fontSize: 11 } };
const visits = { key: 'views', label: 'Visitas', color: 'var(--chart-2)' };
const sales = { key: 'purchases', label: 'Ventas pagas', color: 'var(--order-paid)' };

function Trend({ title, icon: Icon, value, series, points, format = number.format, unit, totals }) {
  return <section className="dashboard-card min-w-0 overflow-hidden" aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
      <div><h2 className="flex items-center gap-2 text-sm font-semibold"><Icon size={16} aria-hidden="true" />{title}</h2>
        {value !== undefined && <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{format(value)}</p>}
      </div>
      {series.length > 1 ? <ul className="flex gap-5">{series.map(s => <li key={s.key}>
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><i className="w-4 border-t-2" style={{ borderColor: s.color, borderStyle: s.dash ? 'dashed' : 'solid' }} />{s.label}</span>
        <strong className="text-xl font-semibold tabular-nums">{number.format(totals[s.key])}</strong>
      </li>)}</ul> : <small className="text-xs text-muted-foreground">{unit}</small>}
    </div>
    <div className="px-2 pb-3 pt-4 sm:px-3">
      <ResponsiveContainer width="100%" height={series.length > 1 ? 218 : 166} minWidth={0}>
        <LineChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis {...axis} dataKey="label" minTickGap={26} tickMargin={8} padding={{ left: 5, right: 5 }} />
          <YAxis {...axis} allowDecimals={false} domain={[0, max => Math.max(1, max)]} width={series[0].key === 'amount' ? 'auto' : 40} tickFormatter={format} />
          <Tooltip labelFormatter={(label, payload) => payload?.[0]?.payload.interval ?? label} formatter={(n, name) => [format(n), name]}
            contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
          {series.map(s => <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5}
            strokeDasharray={s.dash} dot={points.length <= 12 ? { r: 3, fill: 'var(--card)' } : false} activeDot={{ r: 5 }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </section>;
}

function Funnel({ total }) {
  const stages = [
    { label: 'Visitas a la landing', value: total.landingViews, color: 'var(--chart-2)' },
    { label: 'Visitas al checkout', value: total.checkoutViews, color: 'var(--chart-4)' },
    { label: 'Compras pagas', value: total.checkoutPurchases, color: 'var(--order-paid)' },
  ];
  const max = Math.max(1, ...stages.map(stage => stage.value));
  return <section className="dashboard-card p-5 sm:p-6" aria-labelledby="funnel-heading">
    <h2 id="funnel-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight"><ListFilter size={19} aria-hidden="true" />Embudo de compra</h2>
    <ol className="my-5 grid gap-4">{stages.map((stage, i) => <li key={stage.label} className="grid items-center gap-x-4 gap-y-1.5 sm:grid-cols-[10rem_1fr_5rem]">
      <span className="text-sm font-medium">{stage.label}</span>
      <span className="order-last col-span-2 h-3 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1" aria-hidden="true"><span className="block h-full rounded-full" style={{ background: stage.color, width: stage.value / max * 100 + '%' }} /></span>
      <strong className="text-right text-lg tabular-nums">{number.format(stage.value)}</strong>
      {i > 0 && stages[i - 1].value > 0 && <small className="order-last col-span-2 text-xs text-muted-foreground sm:col-span-2 sm:col-start-2">{percent.format(stage.value / stages[i - 1].value)} del volumen de la etapa anterior</small>}
    </li>)}</ol>
    <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">La landing incluye el quiz. El embudo compara volúmenes del período e incluye accesos directos al checkout. La última etapa cuenta pedidos principales pagados.</p>
  </section>;
}

export default function PeriodAnalytics({ data, currency }) {
  const { total } = data;
  const hourly = Boolean(data.hours);
  const unit = hourly ? 'Por hora' : 'Por día';
  const points = (data.hours ?? data.days).map(row => {
    if (hourly) return { ...row, label: clock.format(row.end), interval: clock.format(row.start) + ' – ' + clock.format(row.end) };
    return { ...row, label: row.day.slice(8) + '/' + row.day.slice(5, 7), interval: row.day };
  });
  const currencies = Object.keys(total.revenue).sort();
  if (!currencies.length) currencies.push(currency);
  return <>
    <div className="grid gap-4 lg:grid-cols-2">
      <Trend title="Ventas pagas" icon={ShoppingBag} value={total.purchases} series={[sales]} points={points} unit={unit} />
      {currencies.map(code => <Trend key={code} title={'Total facturado · ' + code} icon={Banknote} value={total.revenue[code] ?? 0}
        series={[{ key: 'amount', label: 'Facturación', color: 'var(--chart-4)' }]} format={n => formatMoney(n, code)}
        points={points.map(row => ({ ...row, amount: row.revenue[code] ?? 0 }))} unit={unit} />)}
    </div>
    <Funnel total={total} />
    <Trend title={'Visitas y compras ' + unit.toLowerCase()} icon={TrendingUp} totals={total} points={points} series={[visits, { ...sales, dash: '6 3' }]} />
  </>;
}

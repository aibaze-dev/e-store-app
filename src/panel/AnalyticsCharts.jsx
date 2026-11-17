import { useId } from 'react';
import { Activity, BarChart3, CalendarDays, ChartNoAxesColumnIncreasing } from 'lucide-react';
import { Area, Bar, BarChart, Brush, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import business from '@/config/businessData.json';

const number = value => new Intl.NumberFormat(business.locale).format(value);
const compact = value => new Intl.NumberFormat(business.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const shortDate = day => `${day.slice(8)}/${day.slice(5, 7)}`;
const fullDate = day => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
const colors = { landing: 'var(--chart-1)', checkout: 'var(--chart-2)', total: 'var(--chart-3)', purchases: 'var(--order-paid)' };
const tick = { fill: 'var(--muted-foreground)', fontSize: 11 };
const axis = { axisLine: false, tickLine: false, tick, tickMargin: 12 };

function ChartTooltip({ active, payload, label, dates = false }) {
  if (!active || !payload?.length) return null;
  return <div className="min-w-44 rounded-xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg">
    <p className="mb-3 text-xs font-medium text-muted-foreground">{dates && /^\d{4}-\d{2}-\d{2}$/.test(label) ? fullDate(label) : label}</p>
    <div className="space-y-2">{payload.map(item => <div key={item.dataKey} className="flex items-center justify-between gap-6 text-xs">
      <span className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: item.color?.startsWith('url(') ? colors.checkout : item.color }} />{item.name}</span>
      <strong className="font-semibold tabular-nums">{number(item.value)}</strong>
    </div>)}</div>
  </div>;
}

function Legend({ items }) {
  return <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Series del gráfico">{items.map(item => <li key={item.label} className="flex items-center gap-2">
    <span aria-hidden="true" className="w-4 border-t-[3px]" style={{ borderColor: item.color, borderStyle: item.dashed ? 'dashed' : 'solid' }} />{item.label}
  </li>)}</ul>;
}

function ChartHeading({ icon: Icon, title, subtitle, children }) {
  return <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-muted/40 text-muted-foreground"><Icon className="size-[18px]" aria-hidden="true" /></span>
      <div><h2 className="text-base font-semibold sm:text-lg">{title}</h2><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground sm:text-sm">{subtitle}</p></div>
    </div>{children}
  </div>;
}

export default function AnalyticsCharts({ data }) {
  const id = useId();
  const first = data.days[0]?.day, last = data.days.at(-1)?.day;
  const series = [{ label: 'Landing', color: colors.landing }, { label: 'Checkout', color: colors.checkout }];
  // An unavailable estimate must not look like a day with no visitors.
  const days = data.days.map(day => ({
    ...day,
    uniques: day.views > 0 && day.uniques === 0 ? null : day.uniques,
    landingUniques: day.landingViews > 0 && day.landingUniques === 0 ? null : day.landingUniques,
    checkoutUniques: day.checkoutViews > 0 && day.checkoutUniques === 0 ? null : day.checkoutUniques,
  }));
  const comparison = [
    { page: 'Landing', people: data.total.landingViews > 0 && data.total.landingUniques === 0 ? null : data.total.landingUniques, color: colors.landing },
    { page: 'Checkout', people: data.total.checkoutViews > 0 && data.total.checkoutUniques === 0 ? null : data.total.checkoutUniques, color: colors.checkout },
  ];

  return <div className="space-y-6">
    <section className="dashboard-card overflow-hidden" aria-label="Evolución diaria">
      <div className="space-y-5 border-b p-5 sm:p-6">
        <ChartHeading icon={Activity} title="Cuánta gente vino" subtitle="Personas estimadas y compras pagadas por día." />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Legend items={[...series, { label: 'En la tienda', color: colors.total, dashed: true }, { label: 'Compras pagadas', color: colors.purchases }]} />
          {first && <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" />{shortDate(first)} — {shortDate(last)} · {data.days.length} {data.days.length === 1 ? 'día' : 'días'}</p>}
        </div>
      </div>
      <div className="p-3 pt-6 sm:p-6" aria-label="Timeline de personas y compras. Valores disponibles en Ver personas y compras por día.">
        <ResponsiveContainer width="100%" height={data.days.length > 31 ? 350 : 310} minWidth={0}>
          <ComposedChart key={`${first}-${last}`} data={days} margin={{ top: 8, right: 12, bottom: 8, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis {...axis} dataKey="day" tickFormatter={shortDate} minTickGap={32} padding={{ left: 12, right: 12 }} />
            <YAxis {...axis} width={42} allowDecimals={false} tickFormatter={compact} domain={[0, 'auto']} />
            <Tooltip content={<ChartTooltip dates />} cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 4' }} />
            <Area type="linear" dataKey="uniques" name={'En la tienda'} stroke={colors.total} strokeDasharray="5 4" strokeWidth={2} fill={colors.total} fillOpacity={0.07} dot={data.days.length === 1 ? { r: 4 } : false} activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }} isAnimationActive={false} />
            <Line type="linear" dataKey="landingUniques" name="Landing" stroke={colors.landing} strokeWidth={2.5} dot={data.days.length < 8 ? { r: 3, strokeWidth: 0 } : false} activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }} isAnimationActive={false} />
            <Line type="linear" dataKey="checkoutUniques" name="Checkout" stroke={colors.checkout} strokeWidth={2.5} strokeDasharray="2 3" dot={data.days.length < 8 ? { r: 3, strokeWidth: 0 } : false} activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }} isAnimationActive={false} />
            <Bar dataKey="purchases" name="Compras pagadas" fill={colors.purchases} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            {data.days.length > 31 && <Brush dataKey="day" ariaLabel="Ajustar inicio o fin del timeline con las flechas" height={32} travellerWidth={12} stroke="var(--muted-foreground)" fill="var(--muted)" tickFormatter={shortDate} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="border-t px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-6">{data.days.length > 31 && 'Mové los extremos del selector inferior para acercar el timeline. '}Las compras se cuentan por fecha de pago confirmado, incluidas las post-compra. No incluyen pendientes, rechazadas, reembolsadas ni cobros en revisión. Las personas se cuentan una vez entre landing y checkout.</p>
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="dashboard-card space-y-5 p-5 sm:p-6" aria-label="Personas por página y día">
        <ChartHeading icon={BarChart3} title="Personas por página y día" subtitle="Compará landing y checkout, día a día." />
        <Legend items={series} />
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <BarChart data={days} margin={{ top: 8, right: 4, bottom: 8, left: 0 }} barGap={3} barCategoryGap="25%" accessibilityLayer>
            <defs><pattern id={`${id}-checkout`} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={colors.checkout} /><path d="M0 6L6 0" stroke="var(--card)" strokeWidth="1" strokeOpacity="0.4" /></pattern></defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis {...axis} dataKey="day" minTickGap={28} tickFormatter={shortDate} />
            <YAxis {...axis} width={40} allowDecimals={false} tickFormatter={compact} />
            <Tooltip content={<ChartTooltip dates />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
            <Bar dataKey="landingUniques" name="Landing" fill={colors.landing} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="checkoutUniques" name="Checkout" fill={`url(#${id}-checkout)`} stroke={colors.checkout} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">Cada persona se cuenta una vez por página en cada día.</p>
      </section>

      <section className="dashboard-card space-y-5 p-5 sm:p-6" aria-label="Comparación por página">
        <ChartHeading icon={ChartNoAxesColumnIncreasing} title="A dónde llegaron" subtitle="Personas estimadas por página en todo el período." />
        <Legend items={series} />
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <BarChart data={comparison} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 0 }} barGap={6} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis {...axis} type="number" allowDecimals={false} tickFormatter={compact} />
            <YAxis {...axis} type="category" dataKey="page" width={76} tickMargin={8} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
            <Bar dataKey="people" name="Personas" fill={colors.landing} radius={[0, 4, 4, 0]} maxBarSize={32} isAnimationActive={false}>
              {comparison.map(page => <Cell key={page.page} fill={page.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">Una persona puede aparecer en ambas páginas. Si vuelve otro día, el total del período no aumenta.</p>
      </section>
    </div>
  </div>;
}

import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/format.js';
import business from '@/config/businessData.json';
import { SOURCE_DIMENSIONS, filterByCampaign, groupSources, sortSources, topSource } from '../../shared/attribution.js';

const number = new Intl.NumberFormat(business.locale);
const percent = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 });
const COLUMNS = [
  ['landingViews', 'Visitas a la landing'], ['checkoutViews', 'Visitas al checkout'], ['purchases', 'Compras'],
  ['conversion', 'Conversión'], ['revenue', 'Facturación'],
];
// The question this report answers first: which one brings more of each.
const LEADERS = [['landingViews', 'Más visitas a la landing'], ['checkoutViews', 'Más visitas al checkout'], ['purchases', 'Más compras']];

// Visits, purchases and revenue of the period by the campaign parameters of the ad link.
export default function CampaignAnalytics({ sources = [], currency }) {
  const selectId = useId();
  const [dimension, setDimension] = useState('ad');
  const [selected, setSelected] = useState('');
  const [sort, setSort] = useState({ column: 'purchases', descending: true });
  const tracked = sources.some(row => row.attribution);
  const campaigns = groupSources(sources, 'campaign').filter(row => row.key);
  // The campaign may leave the report when the period refreshes.
  const campaign = dimension !== 'campaign' && campaigns.some(row => row.key === selected) ? selected : '';
  const groups = groupSources(campaign ? filterByCampaign(sources, campaign) : sources, dimension);
  const rows = sortSources(groups, sort.column, sort.descending);
  const label = SOURCE_DIMENSIONS[dimension].label;
  const leaders = groups.filter(row => row.key).length > 1 ? LEADERS.map(([metric, title]) => ({ metric, title, row: topSource(groups, metric) })) : [];
  // Inside one campaign its name is already on screen.
  const parents = row => campaign && SOURCE_DIMENSIONS[dimension].levels[0] === 'campaign' ? row.parents.slice(1) : row.parents;
  const revenue = row => {
    const codes = Object.keys(row.revenue).sort();
    return codes.length ? codes.map(code => formatMoney(row.revenue[code], code)).join(' · ') : formatMoney(0, currency);
  };
  return <section className="dashboard-card space-y-4 p-5 sm:p-6" aria-labelledby="campaigns-heading">
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
      <h2 id="campaigns-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Megaphone size={19} aria-hidden="true" />Campañas y anuncios</h2>
      {tracked && <div role="group" aria-label="Agrupar por" className="flex max-w-full flex-wrap gap-1">{Object.entries(SOURCE_DIMENSIONS).map(([key, { label }]) =>
        <Button key={key} variant={dimension === key ? 'secondary' : 'ghost'} aria-pressed={dimension === key} className="h-11 px-3 text-xs" onClick={() => setDimension(key)}>{label}</Button>
      )}</div>}
    </div>
    {!tracked ? <p className="text-sm leading-6 text-muted-foreground">Todavía no hay visitas ni compras con parámetros de campaña en este período. Se registran cuando alguien llega desde un enlace con <code>utm_source</code>, <code>utm_campaign</code> y los demás parámetros del anuncio.</p> : <>
      {dimension !== 'campaign' && campaigns.length > 0 && <div className="grid gap-2 sm:max-w-md">
        <Label htmlFor={selectId}>Campaña</Label>
        <NativeSelect id={selectId} value={campaign} onChange={event => setSelected(event.target.value)}>
          <option value="">Todas las campañas</option>
          {campaigns.map(row => <option key={row.key} value={row.key}>{row.name}</option>)}
        </NativeSelect>
      </div>}
      {leaders.length > 0 && <dl className="grid gap-3 sm:grid-cols-3">{leaders.map(({ metric, title, row }) => <div key={metric} className="min-w-0 rounded-lg border p-3">
        <dt className="text-xs font-medium text-muted-foreground">{title}</dt>
        <dd className="mt-1 text-sm leading-5">{row
          ? <><span className="block font-semibold break-words">{row.name}</span><span className="tabular-nums text-muted-foreground">{number.format(row[metric])}</span></>
          : <span className="text-muted-foreground">Sin datos todavía</span>}</dd>
      </div>)}</dl>}
      <div className="max-h-[28rem] overflow-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>{label}</TableHead>
          {COLUMNS.map(([column, title]) => {
            const active = sort.column === column;
            const Icon = !active ? ArrowUpDown : sort.descending ? ArrowDown : ArrowUp;
            return <TableHead key={column} className="px-0 text-right" aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
              <button type="button" className={`ms-auto flex h-11 items-center gap-1 rounded-md px-3 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 ${active ? 'text-foreground' : ''}`}
                onClick={() => setSort({ column, descending: active ? !sort.descending : true })}>
                {title}<Icon size={14} aria-hidden="true" className={active ? '' : 'opacity-50'} />
              </button>
            </TableHead>;
          })}
        </TableRow></TableHeader>
        <TableBody>{rows.map(row => <TableRow key={row.key}>
          <TableCell className="max-w-72 min-w-48 whitespace-normal break-words">{row.key
            ? <><span className="block font-medium">{row.name}</span>
              {parents(row).length > 0 && <span className="block text-xs text-muted-foreground">{parents(row).join(' › ')}</span>}
              {row.id && row.id !== row.name && <span className="block text-xs tabular-nums text-muted-foreground">ID {row.id}</span>}</>
            : <span className="text-muted-foreground">Sin campaña</span>}</TableCell>
          <TableCell className="text-right tabular-nums">{number.format(row.landingViews)}</TableCell>
          <TableCell className="text-right tabular-nums">{number.format(row.checkoutViews)}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums text-[var(--order-paid)]">{number.format(row.purchases)}</TableCell>
          <TableCell className="text-right tabular-nums">{row.landingViews > 0 ? percent.format(row.purchases / row.landingViews) : '—'}</TableCell>
          <TableCell className="text-right whitespace-nowrap tabular-nums">{revenue(row)}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
      <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">El nombre del anuncio llega en <code>utm_content</code> y su ID en <code>ad_id</code>; los anuncios se distinguen por ID y se muestran por nombre. Cada visita y cada compra se asignan al último enlace de anuncio que abrió esa persona en los últimos 7 días. «Sin campaña» reúne los accesos directos y los enlaces sin parámetros. Las compras son pedidos principales pagados; la facturación incluye las ofertas post-compra. La conversión compara compras con visitas a la landing del período.</p>
    </>}
  </section>;
}

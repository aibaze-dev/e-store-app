import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/format.js';
import business from '@/config/businessData.json';
import { SOURCE_DIMENSIONS, groupSources } from '../../shared/attribution.js';

const number = new Intl.NumberFormat(business.locale);
const percent = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 });

// Visits, purchases and revenue of the period by the campaign parameters of the ad link.
export default function CampaignAnalytics({ sources = [], currency }) {
  const [dimension, setDimension] = useState('campaign');
  const tracked = sources.some(row => row.attribution);
  const rows = groupSources(sources, dimension);
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
      <div className="max-h-[28rem] overflow-auto"><Table>
        <TableHeader><TableRow><TableHead>{SOURCE_DIMENSIONS[dimension].label}</TableHead><TableHead className="text-right">Visitas a la landing</TableHead><TableHead className="text-right">Visitas al checkout</TableHead><TableHead className="text-right">Compras</TableHead><TableHead className="text-right">Conversión</TableHead><TableHead className="text-right">Facturación</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map(row => <TableRow key={row.key}>
          <TableCell className="max-w-72 min-w-48 whitespace-normal break-words">{row.key
            ? <><span className="block font-medium">{row.name}</span>{row.parents.length > 0 && <span className="block text-xs text-muted-foreground">{row.parents.join(' › ')}</span>}</>
            : <span className="text-muted-foreground">Sin campaña</span>}</TableCell>
          <TableCell className="text-right tabular-nums">{number.format(row.landingViews)}</TableCell>
          <TableCell className="text-right tabular-nums">{number.format(row.checkoutViews)}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums text-[var(--order-paid)]">{number.format(row.purchases)}</TableCell>
          <TableCell className="text-right tabular-nums">{row.landingViews > 0 ? percent.format(row.purchases / row.landingViews) : '—'}</TableCell>
          <TableCell className="text-right whitespace-nowrap tabular-nums">{revenue(row)}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
      <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">Cada visita y cada compra se asignan al último enlace de anuncio que abrió esa persona en los últimos 7 días. «Sin campaña» reúne los accesos directos y los enlaces sin parámetros. Las compras son pedidos principales pagados; la facturación incluye las ofertas post-compra. La conversión compara compras con visitas a la landing del período.</p>
    </>}
  </section>;
}

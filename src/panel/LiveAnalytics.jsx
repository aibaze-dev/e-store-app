import { useEffect, useState } from 'react';
import { useConvex, useConvexConnectionState } from 'convex/react';
import { BadgeCheck, Clock3, PanelsTopLeft, ShoppingBag, Store, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api.js';
import business from '@/config/businessData.json';
import { PRESENCE_REFRESH_MS, PRESENCE_WINDOW_MS } from '../../shared/analytics.js';

const number = new Intl.NumberFormat(business.locale);
const locations = [
  { key: 'landing', label: 'Landing y quiz', icon: PanelsTopLeft },
  { key: 'checkout', label: 'Checkout', icon: ShoppingBag },
];
const secondaryLocations = [
  { key: 'offer', label: '/oferta', icon: Tag },
  { key: 'thanks', label: '/gracias', icon: BadgeCheck },
];

function useLiveSample(storeId) {
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
        const data = await client.query(api.analytics.liveSessions, { storeId, sample: Date.now() });
        if (active) setState({ status: 'Live', data });
      } catch {
        if (active) setState({ status: 'Reintentando', data: null });
      } finally {
        pending = false;
      }
    };
    refresh();
    const timer = window.setInterval(refresh, PRESENCE_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [storeId, client, isWebSocketConnected]);
  return state;
}

function Presence({ data, status }) {
  let boundary = 0;
  const segments = data?.total && [...locations, ...secondaryLocations].map(({ key }) => {
    const start = boundary;
    boundary += 100 * (data[key] ?? 0) / data.total;
    return `var(--presence-${key}) ${start}% ${boundary}%`;
  });
  return <section className="presence-board" aria-labelledby="presence-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="presence-heading" className="text-lg font-semibold tracking-tight">Actividad en vivo</h2>
      <Badge variant="outline" className="presence-badge" data-live={status === 'Live'} role="status">
        <span aria-hidden="true" />{status}
      </Badge>
    </div>
    <div className="presence-grid">
      <div className="presence-total">
        <div aria-hidden="true" className="presence-ring" style={segments ? { background: `conic-gradient(${segments.join(', ')})` } : undefined}><Store size={22} /></div>
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
    <dl className="presence-secondary">
      {secondaryLocations.map(({ key, label, icon: Icon }) => <div key={key}>
        <dt><Icon size={14} aria-hidden="true" style={{ color: `var(--presence-${key})` }} />{label}</dt>
        <dd>{data?.[key] != null ? number.format(data[key]) : '—'}</dd>
      </div>)}
    </dl>
    <p className="presence-foot"><Clock3 size={13} aria-hidden="true" />Actividad en los últimos {PRESENCE_WINDOW_MS / 1000} s · Se actualiza cada {PRESENCE_REFRESH_MS / 1000} s</p>
  </section>;
}

export default function LiveAnalytics({ storeId }) {
  const presence = useLiveSample(storeId);
  return <Presence {...presence} />;
}

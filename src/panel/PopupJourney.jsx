import { popupJourney } from '../../shared/popup-journey.js';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PopupJourney({ view, target, onChoose }) {
  if (!view) return <p className="p-5 text-sm">Elegí un producto principal para ver los modales.</p>;
  const entries = popupJourney(view);
  const selected = entries.find(item => item.target === target);
  return <section className="popup-journey" aria-label="Mapa de modales">
    <div className="space-y-2"><h2 className="text-xl font-semibold">Todos los modales, en un solo lugar</h2><p className="text-sm leading-6 text-muted-foreground">{entries.length} variantes posibles · {entries.filter(item => item.enabled).length} activas con esta configuración. Elegí una tarjeta para verla. Las desactivadas se pueden revisar sin activarlas.</p></div>
    {['Antes del pago', 'Después del pago'].map(group => <div className="space-y-3" key={group}><h3 className="text-sm font-semibold">{group}</h3><div className="popup-journey-grid">{entries.filter(item => item.group === group).map(item => <button key={item.target} type="button" aria-pressed={target === item.target} onClick={() => onChoose(item.target)} className="popup-journey-card">
      <span className="flex items-center justify-between gap-2"><strong>{item.title}</strong><Eye className="size-4 shrink-0" aria-hidden="true" /></span>
      <span className="text-xs">{item.enabled ? 'Activado' : 'Desactivado o sin oferta configurada'}</span>
      <span className="text-sm leading-6 text-muted-foreground">{item.trigger}</span>
    </button>)}</div></div>)}
    {selected && <div className="rounded-xl border bg-card p-4 text-sm leading-6" role="status"><strong>Estás viendo: {selected.title}</strong><p>Al aceptar: {selected.accept}</p><p>Al rechazar: {selected.decline}</p>{selected.group === 'Después del pago' && <p>Cerrar con × descarta esa etapa. Las reaperturas continúan con la siguiente: hasta una al volver a la pestaña y dos al salir con el mouse.</p>}</div>}
    <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={() => onChoose('popup-back-page')}>Ver página de destino del descuento</Button><span className="text-xs text-muted-foreground">Es una página, no un modal. En la vista previa no se crean compras.</span></div>
  </section>;
}

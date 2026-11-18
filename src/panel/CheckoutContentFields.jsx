import { CHECKOUT_DEFAULTS, CHECKOUT_FIELDS, CHECKOUT_FLAGS, CHECKOUT_GROUPS, CHECKOUT_OPTIONAL_FIELDS } from '../../shared/checkout-copy.js';
import { Field } from '@/components/Field.jsx';
import { NativeSelect } from '@/components/ui/native-select';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CopyFields, OptionFields } from './PurchaseCopyFields.jsx';

const FLAG_HINTS = {
  showActivity: 'Simulada: entre 2 y 15 personas.',
  showTimer: 'Simulado: vuelve a empezar al llegar a cero; no cambia precios.',
  notifications: 'Nombres y ciudades ficticios; no generan órdenes ni métricas.',
};
// The exit popup texts live in the Popups tab, next to the other popups.
const GROUPS = Object.entries(CHECKOUT_GROUPS).filter(([group]) => group !== 'exit');

export default function CheckoutContentFields({ copy, onChange, disabled, storeId, onOpenPopups, children }) {
  return <>
    <section className="dashboard-card space-y-5 p-5 sm:p-6">
      <div className="space-y-1.5"><h2 className="text-lg font-semibold">Presentación del checkout</h2>
        <p className="text-sm leading-6 text-muted-foreground">Los cambios se ven al instante en la vista previa. «Guardar y publicar» los aplica al checkout público.</p></div>
      <OptionFields fields={CHECKOUT_FLAGS} hints={FLAG_HINTS} value={copy} onChange={onChange} disabled={disabled} />
      <Field label="Idioma de los campos de Stripe" hint="Stripe controla los textos y errores dentro del medio de pago: se elige su idioma, no cada etiqueta.">{ids => <NativeSelect {...ids} value={copy.paymentLocale} disabled={disabled} onChange={event => onChange({ paymentLocale: event.target.value })}><option value="es">Español</option><option value="en">Inglés</option><option value="pt">Portugués</option><option value="auto">Idioma del navegador</option></NativeSelect>}</Field>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link className="underline underline-offset-4" to={`/panel/tiendas/${storeId}/productos`}>Editar productos, bonos, extras y precios</Link>
        {onOpenPopups && <button type="button" className="underline underline-offset-4" onClick={onOpenPopups}>Editar el popup al salir</button>}
      </div>
    </section>
    {children}
    {GROUPS.map(([group, title], index) => {
      const fields = Object.fromEntries(Object.entries(CHECKOUT_FIELDS).filter(([, field]) => field.group === group));
      return <details id={`checkout-${group}`} key={group} className="landing-form-section" open={group === 'header' || undefined}>
        <summary><span className="landing-section-number">{String(index + 2).padStart(2, '0')}</span><span><strong>{title}</strong><small>{Object.keys(fields).length} textos del checkout</small></span><ChevronDown aria-hidden="true" /></summary>
        <div className="landing-section-fields"><CopyFields fields={fields} value={copy} defaults={CHECKOUT_DEFAULTS} optional={CHECKOUT_OPTIONAL_FIELDS} maxLength={600} onChange={onChange} disabled={disabled} /></div>
      </details>;
    })}
    {onOpenPopups && <Button type="button" variant="outline" className="justify-between" onClick={onOpenPopups}>Textos del popup al salir del checkout<ArrowRight aria-hidden="true" /></Button>}
  </>;
}

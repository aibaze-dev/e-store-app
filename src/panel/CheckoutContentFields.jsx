import { CHECKOUT_FIELDS, CHECKOUT_FLAGS, CHECKOUT_GROUPS, CHECKOUT_OPTIONAL_FIELDS } from '../../shared/checkout-copy.js';
import { Field } from '@/components/Field.jsx';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { Link } from 'react-router-dom';

export default function CheckoutContentFields({ copy, onChange, disabled, storeId, children }) {
  return <>
    <section className="dashboard-card space-y-4 p-5">
      <h2 className="text-lg font-semibold">Presentación del checkout</h2>
      <p className="text-sm leading-6 text-muted-foreground">Los cambios se ven al instante en la vista previa. Guardá el borrador para seguir después o guardá y publicá para aplicarlos al checkout.</p>
      {Object.entries(CHECKOUT_FLAGS).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={copy[key]} disabled={disabled} onChange={event => onChange({ [key]: event.target.checked })} />{label}</label>)}
      <p className="text-xs leading-5 text-muted-foreground">La actividad, el contador y los avisos son simulados. El contador vuelve a comenzar al llegar a cero; no cambia precios ni bloquea pagos.</p>
      <Field label="Idioma de los campos de Stripe" hint="Stripe controla los textos y errores dentro del medio de pago; se puede elegir su idioma, pero no reescribir cada etiqueta.">{ids => <NativeSelect {...ids} value={copy.paymentLocale} disabled={disabled} onChange={event => onChange({ paymentLocale: event.target.value })}><option value="es">Español</option><option value="en">Inglés</option><option value="pt">Portugués</option><option value="auto">Idioma del navegador</option></NativeSelect>}</Field>
      <Link className="text-sm underline" to={`/panel/tiendas/${storeId}/productos`}>Editar productos, bonos, extras y precios</Link>
    </section>
    {children}
    {Object.entries(CHECKOUT_GROUPS).map(([group, title], index) => <details id={`checkout-${group}`} key={group} className="landing-form-section" open={group === 'header' || undefined}>
      <summary><span className="landing-section-number">{String(index + 2).padStart(2, '0')}</span><span><strong>{title}</strong><small>Textos del checkout</small></span></summary>
      <div className="landing-section-fields">{Object.entries(CHECKOUT_FIELDS).filter(([, field]) => field.group === group).map(([key, field]) => {
        const variables = field.value.match(/\{[^{}]+\}/g);
        const Control = field.value.length > 75 ? Textarea : Input;
        return <Field key={key} label={field.label} hint={variables ? `Variables disponibles: ${variables.join(', ')}.` : undefined}>{ids => <Control {...ids} value={copy[key]} maxLength={600} required={!CHECKOUT_OPTIONAL_FIELDS.includes(key)} disabled={disabled} onChange={event => onChange({ [key]: event.target.value })} />}</Field>;
      })}</div>
    </details>)}
  </>;
}

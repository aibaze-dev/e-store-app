import { useId } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

// One editable text of the checkout, popups or post-purchase. `fallback` is what the buyer
// sees when the field was never edited; the reset button brings it back.
function CopyField({ name, field, value, fallback, onChange, disabled, maxLength, optional }) {
  const id = useId();
  const variables = field.value.match(/\{[^{}]+\}/g) ?? [];
  const Control = (fallback || field.value).length > 75 ? Textarea : Input;
  const current = value ?? fallback;
  const changed = value !== undefined && value !== fallback;
  return <div className="copy-field">
    <div className="copy-field-head">
      <Label htmlFor={id}>{field.label}</Label>
      {optional && <span className="copy-field-tag">Opcional</span>}
      {changed && <button type="button" className="copy-field-reset" disabled={disabled} onClick={() => onChange({ [name]: fallback })}><RotateCcw aria-hidden="true" />Restaurar</button>}
    </div>
    <Control id={id} aria-describedby={variables.length ? `${id}-vars` : undefined} value={current} rows={Control === Textarea ? 3 : undefined}
      onChange={event => onChange({ [name]: event.target.value })} maxLength={maxLength} required={!optional} disabled={disabled} />
    {variables.length > 0 && <p id={`${id}-vars`} className="copy-field-vars"><span>Variables:</span>{variables.map(variable => <code key={variable}>{variable}</code>)}</p>}
  </div>;
}

export function CopyFields({ fields, value = {}, defaults = {}, onChange, disabled, maxLength = 1200, optional = [] }) {
  return <div className="copy-fields">{Object.entries(fields).map(([key, field]) => <CopyField key={key} name={key} field={field} value={value[key]} fallback={defaults[key] ?? field.value}
    onChange={onChange} disabled={disabled} maxLength={maxLength} optional={optional.includes(key)} />)}</div>;
}

// A collapsible group of texts inside a section.
export function CopyGroup({ title, count, children, defaultOpen = false }) {
  return <details className="copy-group" open={defaultOpen || undefined}>
    <summary><span><strong>{title}</strong><small>{count} {count === 1 ? 'texto' : 'textos'}</small></span><ChevronDown aria-hidden="true" /></summary>
    <div className="copy-group-body">{children}</div>
  </details>;
}

// On/off switches. `hints` optionally explains each one under its label.
export function OptionFields({ fields, value, onChange, disabled, hints = {} }) {
  return <ul className="option-list">{Object.entries(fields).map(([key, label]) => <OptionRow key={key} label={label} hint={hints[key]} checked={Boolean(value[key])} disabled={disabled} onChange={checked => onChange({ [key]: checked })} />)}</ul>;
}

function OptionRow({ label, hint, checked, disabled, onChange }) {
  const id = useId();
  return <li className="option-row">
    <label htmlFor={id}><span>{label}</span>{hint && <small>{hint}</small>}</label>
    <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
  </li>;
}

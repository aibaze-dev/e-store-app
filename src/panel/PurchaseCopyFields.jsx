import { Field } from '@/components/Field.jsx';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function CopyFields({ fields, value, onChange, disabled, maxLength = 1200 }) {
  return Object.entries(fields).map(([key, field]) => {
    const variables = field.value.match(/\{[^{}]+\}/g);
    const Control = field.value.length > 75 ? Textarea : Input;
    return <Field key={key} label={field.label} hint={variables ? `Variables disponibles: ${variables.join(', ')}.` : undefined}>{ids => <Control {...ids} value={value[key] ?? field.value} onChange={event => onChange({ [key]: event.target.value })} maxLength={maxLength} disabled={disabled} />}</Field>;
  });
}
export function OptionFields({ fields, value, onChange, disabled }) {
  return Object.entries(fields).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 shrink-0 accent-primary" checked={value[key]} onChange={event => onChange({ [key]: event.target.checked })} disabled={disabled} />{label}</label>);
}

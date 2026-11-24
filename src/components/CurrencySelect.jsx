import { CURRENCIES, isSupportedCurrency } from '../../shared/currencies.js';
import { NativeSelect } from '@/components/ui/native-select';

// Only currencies Stripe charges with the same decimals as our prices. A code saved before
// the list existed stays visible so the form shows the real value, but it cannot be saved.
export default function CurrencySelect({ value, onChange, compact = false, ...props }) {
  const current = String(value ?? '').toUpperCase();
  return <NativeSelect {...props} value={current} onChange={event => onChange(event.target.value)}>
    {current && !isSupportedCurrency(current) && <option value={current} disabled>{current} (no disponible)</option>}
    {CURRENCIES.map(({ code, name }) => <option key={code} value={code}>{compact ? code : `${code} · ${name}`}</option>)}
  </NativeSelect>;
}

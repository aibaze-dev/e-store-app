import { ConvexError } from 'convex/values';
import business from '@/config/businessData.json';
import { currencyDigits, formatCurrency } from '../../shared/currencies.js';

// Amounts are stored as integers in the currency's minor unit. The panel shows the ISO code
// so stores in different currencies that share a symbol ($) are not confused.
const digits = currencyDigits;

export function formatMoney(amount, currency) {
  return formatCurrency(amount, currency, { code: true });
}

// Strict on purpose: no thousands separators and no more decimals than the currency has.
// "19.990" in CLP or "16.990" in ARS is rejected (NaN) instead of becoming 20 or 16,99.
export function toMinor(text, currency) {
  const value = String(text ?? '').trim();
  const places = digits(currency);
  const pattern = places ? new RegExp(`^\\d+(?:[.,]\\d{1,${places}})?$`) : /^\d+$/;
  if (!pattern.test(value)) return NaN;
  return Math.round(Number(value.replace(',', '.')) * 10 ** places);
}

// Shown next to amount fields and in their error messages.
export function amountHint(currency) {
  const places = digits(currency);
  return places ? `Sin separador de miles, hasta ${places} decimales. Ejemplo: 1999.90` : `Sin decimales ni separador de miles. Ejemplo: 19990`;
}

export function fromMinor(amount, currency) {
  return amount ? (amount / 10 ** digits(currency)).toFixed(digits(currency)) : '';
}

export function formatDate(timestamp) {
  return new Intl.DateTimeFormat(business.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: business.timeZone }).format(timestamp);
}

// Server validation messages are written for people; anything else gets the fallback.
export function errorText(error, fallback = 'No se pudo completar la acción. Volvé a intentar.') {
  return error instanceof ConvexError && typeof error.data === 'string' ? error.data : fallback;
}

export const STATUS_LABELS = { pending: 'Pendiente', paid: 'Pagado', expired: 'Vencido', refunded: 'Reembolsado', failed: 'Rechazado', needs_review: 'Revisar cobro' };
export const EMAIL_LABELS = { pending: 'Email de entrega en cola', sent: 'Email de entrega enviado', failed: 'El email de entrega falló', skipped: 'Email de entrega no enviado' };
export const EMAIL_ERRORS = { not_configured: 'falta configurar Resend', no_recipient: 'sin email del comprador', status_changed: 'la compra cambió de estado' };

import { ConvexError } from 'convex/values';
import business from '@/config/businessData.json';

// Amounts are stored as integers in the currency's minor unit.
function digits(currency) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits; } catch { return 2; }
}

export function formatMoney(amount, currency) {
  const value = amount / 10 ** digits(currency);
  try { return new Intl.NumberFormat(business.locale, { style: 'currency', currency }).format(value); } catch { return `${value} ${currency}`; }
}

export function toMinor(text, currency) {
  const value = Number(String(text).trim().replace(',', '.'));
  return String(text).trim() && Number.isFinite(value) ? Math.round(value * 10 ** digits(currency)) : NaN;
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

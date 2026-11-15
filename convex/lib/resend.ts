// Minimal Resend REST client over fetch, like the Stripe one: no SDK in the Convex runtime.
const API = 'https://api.resend.com/emails';

export type EmailMessage = { from: string; to: string[]; subject: string; html: string; text: string; replyTo?: string };
export type SendResult = { ok: true; id: string } | { ok: false; retryable: boolean; error: string };

export function resendSettings() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return apiKey && from ? { apiKey, from, replyTo: process.env.EMAIL_REPLY_TO || undefined } : null;
}

// The idempotency key makes a retry of the same email a no-op on Resend's side (24 h).
export async function sendEmail(apiKey: string, message: EmailMessage, idempotencyKey: string): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        from: message.from, to: message.to, subject: message.subject, html: message.html, text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
  } catch {
    return { ok: false, retryable: true, error: 'network' };
  }
  const body = await response.json().catch(() => null);
  if (response.ok && typeof body?.id === 'string') return { ok: true, id: body.id };
  const error = typeof body?.name === 'string' ? body.name : `http_${response.status}`;
  return { ok: false, retryable: response.status === 429 || response.status >= 500, error };
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ESCAPES[char]);
export const safeUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : '');

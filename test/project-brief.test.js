import { afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { api } from './api';
import { backend } from './helpers';
import { readSession, remainingSeconds, reportOpening, saveSession, STORAGE_KEY } from '../src/artifacts/project-brief/session';
import { formatProjectBrief, projectSections } from '../src/artifacts/project-brief/questions';
import { DELIVERY_WINDOW_MS, PROJECT_BRIEF_LIMIT } from '../shared/project-brief';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('keeps the first opening, retry ID and receipt through reloads and expiry', () => {
  const records = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: key => records.get(key) ?? null, setItem: (k, v) => records.set(k, v) } });
  records.set(STORAGE_KEY, 'corrupt');
  vi.useFakeTimers();
  const session = readSession();
  expect(remainingSeconds(session.firstLoad, Date.now())).toBe(48 * 3600);
  vi.setSystemTime(session.firstLoad + DELIVERY_WINDOW_MS - 1);
  expect(readSession()).toEqual(session);
  expect(remainingSeconds(session.firstLoad, Date.now())).toBe(1);
  saveSession({ ...session, submitted: true });
  vi.setSystemTime(session.firstLoad + DELIVERY_WINDOW_MS + 10_000);
  expect(readSession()).toEqual({ ...session, submitted: true });
  expect(remainingSeconds(session.firstLoad, Date.now())).toBe(0);
});

const project = {
  name: ' Ada ', email: 'ada@example.com', brief: 'A booking form', business: 'Studio',
  product: 'Landing page', requestId: 'fd9a5a00-d948-4a68-a2a2-a688faa303bf',
  firstLoad: Date.parse('2026-11-20T07:00:00Z'),
};

const session = { requestId: project.requestId, firstLoad: project.firstLoad };
const leadId = '0123456789abcdef01234567';

it('sends an opening once across mounts, retries failures and remembers the acknowledgement', async () => {
  const records = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: key => records.get(key) ?? null, setItem: (k, v) => records.set(k, v) } });
  const notify = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(null);
  await expect(reportOpening(session, notify)).rejects.toThrow('offline');
  await Promise.all([reportOpening(session, notify), reportOpening(session, notify)]);
  vi.resetModules();
  const reloaded = await import('../src/artifacts/project-brief/session');
  await reloaded.reportOpening(session, notify);
  expect(notify).toHaveBeenCalledTimes(2);
  expect(notify).toHaveBeenLastCalledWith(session);
});

it('opens one B2C record before the form and only edits that record on submission or retry', async () => {
  const t = backend();
  vi.stubEnv('AIBAZE_API_URL', 'https://crm.example.com');
  const fetch = vi.fn()
    .mockRejectedValueOnce(new Error('response lost'))
    .mockResolvedValueOnce(Response.json({ received: true, id: leadId }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ received: true }));
  vi.stubGlobal('fetch', fetch);
  await expect(t.action(api.project_brief.open, session)).rejects.toThrow();
  await t.action(api.project_brief.open, session);
  expect(fetch).toHaveBeenCalledTimes(2);
  const [url, opening] = fetch.mock.calls[0];
  expect(url).toBe('https://crm.example.com/api/v1/webhooks/b2c-oportunity');
  expect(opening.method).toBe('POST');
  expect(fetch.mock.calls[1]).toEqual(fetch.mock.calls[0]);
  expect(opening.body).not.toContain(session.requestId);
  expect(JSON.parse(opening.body)).toMatchObject({
    customData: { email: null, case: expect.stringContaining('2026-11-22T07:00:00.000Z') },
    calendar: { appointmentId: 'ateneo-project-brief:' + createHash('sha256').update(session.requestId).digest('hex') },
  });
  await expect(t.action(api.project_brief.submit, project)).rejects.toThrow();
  expect(await t.action(api.project_brief.submit, project)).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(4);
  const [updateUrl, update] = fetch.mock.calls[2];
  expect(updateUrl).toBe('https://crm.example.com/api/v1/webhooks/b2c-oportunity/project-brief');
  expect(update.method).toBe('PATCH');
  expect(fetch.mock.calls[3]).toEqual(fetch.mock.calls[2]);
  expect(JSON.parse(update.body)).toEqual({ fullName: 'Ada', email: project.email, companyName: 'Studio', product: 'Landing page', projectIdea: project.brief });
  expect(opening.headers['X-Project-Brief-Key']).toBe(session.requestId);
  expect(update.headers['X-Project-Brief-Key']).toBe(session.requestId);
});

it('validates buyer input before contacting the webhook', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const t = backend();
  for (const invalid of [{ email: 'no-email' }, { name: ' ' }, { brief: ' ' }, { brief: 'x'.repeat(PROJECT_BRIEF_LIMIT + 1) }, { product: 'Unknown' }, { firstLoad: -1 }]) {
    await expect(t.action(api.project_brief.submit, { ...project, ...invalid })).rejects.toThrow();
  }
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  ['Landing page', 'Socials: @studio'],
  ['Custom system', 'Workflow: Manager approves the booking'],
])('sends only the selected %s answers through the existing projectIdea field', async (product, detail) => {
  const answers = {
    Bottleneck: '  Bookings get lost in messages.  ', Goal: '  ', Socials: '@studio',
    Workflow: 'Manager approves the booking',
  };
  const brief = formatProjectBrief(projectSections(product), answers);
  expect(brief).toBe('Bottleneck: Bookings get lost in messages.\n' + detail);
  const fetch = vi.fn().mockResolvedValue(Response.json({ received: true }));
  vi.stubGlobal('fetch', fetch);
  await backend().action(api.project_brief.submit, { ...project, product, brief });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    fullName: 'Ada', email: project.email, companyName: project.business, product, projectIdea: brief,
  });
});

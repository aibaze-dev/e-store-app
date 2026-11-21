import { v } from 'convex/values';
import { action } from './lib/functions';
import { fail } from './lib/validation';
import { DELIVERY_WINDOW_MS, validProjectSession } from '../shared/project-brief';

const sessionArgs = { requestId: v.string(), firstLoad: v.number() };

function apiUrl(path: string) {
  return new URL(path, process.env.AIBAZE_API_URL || 'https://backend.aibaze.agency').href;
}

export const open = action({
  args: sessionArgs,
  handler: async (_ctx, args): Promise<null> => {
    if (!validProjectSession(args.firstLoad, args.requestId)) fail('Invalid project session.');
    const due = new Date(args.firstLoad + DELIVERY_WINDOW_MS).toISOString();
    // Older B2C deployments deduplicate by the body field, newer ones derive
    // the same value from the private header. Never expose the key in the body.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(args.requestId.toLowerCase()));
    const appointmentId = 'ateneo-project-brief:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const response = await fetch(apiUrl('/api/v1/webhooks/b2c-oportunity'), {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-Project-Brief-Key': args.requestId },
      body: JSON.stringify({
        customData: {
          full_name: null, email: null, phone: null, company_name: null, website: null,
          investment_option: 'Already purchased', product: null, price: null, project_idea: null,
          case: `Post-purchase project brief. First opened ${new Date(args.firstLoad).toISOString()}. Delivery due ${due}.`,
          utm_source: 'project-brief', utm_medium: 'post_purchase', utm_campaign: 'custom-project-delivery',
          utm_content: null, utm_term: null, fb_click_id: null, reschedule_link: null, cancel_link: null,
        },
        contact_source: 'Post-purchase project brief',
        calendar: { appointmentId },
        country: null,
        attributionSource: {
          url: process.env.SITE_URL ? new URL('/a/project-brief', process.env.SITE_URL).href : null,
          ip: null, userAgent: null,
        },
      }),
    });
    const body = response.ok ? await response.json() : null;
    if (body?.received !== true) {
      fail('Could not confirm the project opportunity.');
    }
    return null;
  },
});

export const submit = action({
  args: {
    ...sessionArgs,
    name: v.string(), email: v.string(), business: v.string(), brief: v.string(),
    product: v.union(v.literal('Landing page'), v.literal('Custom system')),
  },
  handler: async (_ctx, args): Promise<null> => {
    const name = args.name.trim();
    const email = args.email.trim();
    const business = args.business.trim();
    const brief = args.brief.trim();
    if (!name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        business.length > 160 || !brief || brief.length > 2000) fail('Check your contact and project details.');
    if (!validProjectSession(args.firstLoad, args.requestId)) fail('Invalid project session.');
    const response = await fetch(apiUrl('/api/v1/webhooks/b2c-oportunity/project-brief'), {
      method: 'PATCH',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-Project-Brief-Key': args.requestId },
      body: JSON.stringify({ fullName: name, email, companyName: business || null, product: args.product, projectIdea: brief }),
    });
    if (!response.ok || (await response.json())?.received !== true) fail('Could not confirm receipt of your brief.');
    return null;
  },
});

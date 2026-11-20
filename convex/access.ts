import { action } from './lib/functions';
import { adminIpAllowed } from './lib/admin_ip';
import { clientIp } from './lib/request_ip';

// Tells the root page whether to show the login. It only hides the form: the real check is the
// sign-in hook in auth.ts. Denied IPs show up in the Convex logs, to find the one to allow.
export const check = action({
  args: {},
  handler: async ctx => {
    const allowed = await adminIpAllowed(ctx);
    if (!allowed) console.log(`Login hidden for IP ${await clientIp(ctx)}`);
    return allowed;
  },
});

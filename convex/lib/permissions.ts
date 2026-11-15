import { ConvexError } from 'convex/values';
import { requireUser } from '../auth';
import { isAdminEmail } from './admin_emails';

// Every panel query/mutation calls this before touching data.
export async function requireAdmin(ctx: any) {
  const user = await requireUser(ctx);
  if (!isAdminEmail(user.email)) throw new ConvexError('Tu cuenta no tiene acceso al panel.');
  return user;
}

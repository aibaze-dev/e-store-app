// Panel access comes from the ADMIN_EMAILS Convex variable (comma separated).
// Signing up never grants access by itself.
export function isAdminEmail(email: string | null | undefined, list = process.env.ADMIN_EMAILS) {
  if (!email) return false;
  const allowed = (list || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

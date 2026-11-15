// Panel access comes from the ADMIN_EMAILS Convex variable (comma separated).
// Signing up never grants access by itself.
export function adminEmails(list = process.env.ADMIN_EMAILS) {
  return (list || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, list = process.env.ADMIN_EMAILS) {
  if (!email) return false;
  return adminEmails(list).includes(email.trim().toLowerCase());
}

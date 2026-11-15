// A landing is served at <subdomain>.<base host> and also at <base>/l/<subdomain>.
function base() {
  try { return new URL(import.meta.env.VITE_SITE_URL); } catch { return new URL(window.location.origin); }
}

export function resolveSubdomain(hostname = window.location.hostname) {
  const baseHost = base().hostname;
  if (hostname === baseHost || !hostname.endsWith(`.${baseHost}`)) return null;
  const subdomain = hostname.slice(0, -baseHost.length - 1);
  return subdomain && !subdomain.includes('.') && subdomain !== 'www' ? subdomain : null;
}

export function landingUrls(subdomain) {
  const site = base();
  return { path: `${site.origin}/l/${subdomain}`, host: `${site.protocol}//${subdomain}.${site.host}` };
}

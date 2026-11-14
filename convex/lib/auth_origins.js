// Only explicit origins belonging to this project are trusted, never domain suffixes.
export function authOrigins(env) {
  const values = [env.SITE_URL, env.CONVEX_SITE_URL, 'http://localhost:5173', 'http://127.0.0.1:5173',
    ...(env.BETTER_AUTH_TRUSTED_ORIGINS || '').split(',')];
  if (Number(env.AIBAZE_AUTH_PREVIEW_EXPIRES_AT) > Date.now()) values.push(env.AIBAZE_AUTH_PREVIEW_ORIGIN);
  return [...new Set(values.filter(Boolean).map(value => {
    const url = new URL(value.trim());
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
      throw new Error('Invalid authentication origin');
    }
    return url.origin;
  }))];
}

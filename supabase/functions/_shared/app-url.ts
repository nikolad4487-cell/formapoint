/** APP_URL is a browser origin, never an arbitrary redirect target. */
export function normalizeAppUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('APP_URL nije ispravno konfiguriran');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('APP_URL mora sadržavati samo javnu adresu aplikacije');
  return url.origin;
}
export function allowedAppOrigin(origin: string | null, configured: string | undefined): string {
  if (!origin || !configured) return 'null';
  try {
    const app = normalizeAppUrl(configured);
    if (origin === app) return origin;
    const production = new Set(['https://formapoint.online', 'https://www.formapoint.online']);
    return production.has(app) && production.has(origin) ? origin : 'null';
  } catch {
    return 'null';
  }
}

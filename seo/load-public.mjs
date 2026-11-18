import { normaliseServices, safeUrl } from './pages.mjs';

export function publicConfig(env, fallback) {
  const explicit = Boolean(
    env.VITE_SUPABASE_URL?.trim() ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.VITE_SUPABASE_ANON_KEY?.trim(),
  );
  const url = (explicit ? env.VITE_SUPABASE_URL || '' : fallback.url).trim();
  const key = (
    explicit
      ? env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || ''
      : fallback.publishableKey
  ).trim();
  let publicKey = key.startsWith('sb_publishable_');
  try {
    publicKey ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon';
  } catch {
    /* Modern publishable keys do not use JWT. */
  }
  const parsed = new URL(url);
  if (
    !publicKey ||
    !['https:', 'http:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    env.VITE_SUPABASE_DISABLED === 'true'
  )
    throw new Error('PublicConfigurationUnavailable');
  return { url: parsed.origin, key };
}
export async function loadPublicSnapshot(config, fetcher = fetch) {
  async function request(path, { optional = false, body } = {}) {
    const response = await fetcher(`${config.url}/rest/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok) {
      if (optional && ['PGRST202', 'PGRST205', '42883', '42P01'].includes(data?.code)) return null;
      throw new Error('PublicDataUnavailable');
    }
    return data;
  }
  // Only the anonymous/public role is used, even when a signed-in visitor requests HTML.
  await request('rpc/refresh_service_prices', { optional: true, body: {} });
  const [rows, siteRows, pages, portfolio, methods] = await Promise.all([
    request('services?select=*,service_categories(slug)&active=eq.true&order=sort_order'),
    request('site_settings?select=*&id=eq.true'),
    request('content_pages?select=*&published=eq.true&limit=200', { optional: true }),
    request(
      'portfolio_items?select=id,title,description,pdf_url,published,publication_rights,scan_status,created_at&published=eq.true&publication_rights=eq.true&limit=100',
      { optional: true },
    ),
    request('payment_methods?select=*&enabled=eq.true&order=created_at', { optional: true }),
  ]);
  if (!Array.isArray(rows) || !siteRows?.[0]) throw new Error('PublicDataUnavailable');
  const ids = rows.filter((row) => row.packages_enabled).map((row) => row.id);
  const packages = ids.length
    ? await request(
        `service_variants?select=*&service_id=in.(${ids.map(encodeURIComponent).join(',')})&active=eq.true&archived=eq.false&order=sort_order`,
      )
    : [];
  const site = siteRows[0],
    settings = { id: true };
  for (const name of [
    'platform_name',
    'public_contact_email',
    'contact_phone',
    'facebook_url',
    'instagram_url',
    'linkedin_url',
    'whatsapp_community_url',
    'stripe_enabled',
    'bank_enabled',
    'maintenance',
    'final_payment_days',
    'cancellation_days',
    'policies_approved',
  ])
    if (site[name] !== undefined) settings[name] = site[name];
  settings.payment_icons = Object.fromEntries(
    Object.entries(site.payment_icons || {}).filter(([, value]) => safeUrl(value)),
  );
  return {
    services: normaliseServices(rows, packages || []),
    settings,
    pages: (pages || [])
      .filter((page) => page.published && (!page.is_legal || page.approved_at))
      .map((page) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        content: page.content,
        published: true,
        is_legal: Boolean(page.is_legal),
        approved_at: page.approved_at || null,
        approved_by: null,
        created_at: page.created_at,
        updated_at: page.updated_at,
      })),
    portfolio: (portfolio || [])
      .filter(
        (item) =>
          item.published &&
          item.publication_rights &&
          ['clean', 'linked'].includes(item.scan_status),
      )
      .map((item) => ({ ...item, file_path: null })),
    methods:
      methods === null
        ? null
        : methods
            .filter(
              (method) =>
                method.enabled &&
                ((method.provider === 'bank' && method.code === 'iban') ||
                  (method.provider === 'stripe' &&
                    ['visa', 'mastercard', 'google_pay', 'apple_pay'].includes(method.code) &&
                    (['visa', 'mastercard'].includes(method.code) || method.verified))),
            )
            .map((method) => ({
              id: method.id,
              code: method.code,
              name: method.name,
              provider: method.provider,
              enabled: true,
              verified: method.verified,
              icon_url: safeUrl(method.icon_url),
              created_at: method.created_at,
            })),
  };
}

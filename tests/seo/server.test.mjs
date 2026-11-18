import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createPublicHandler } from '../../api/public.js';
import { cleanPath, makePage, renderHtml, sitemap, safeJson } from '../../seo/pages.mjs';
import { loadPublicSnapshot, publicConfig } from '../../seo/load-public.mjs';
import { fixture, template } from './fixture.mjs';

async function server(t, options = {}) {
  const app = createServer(
    createPublicHandler({
      load: async () => fixture(),
      template: async () => template,
      environment: {},
      ...options,
    }),
  );
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => app.close(resolve)));
  return (path, init) =>
    fetch(`http://127.0.0.1:${app.address().port}${path}`, { redirect: 'manual', ...init });
}
function jsonScript(html, id) {
  return JSON.parse(html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`))[1]);
}
test('raw public HTML contains current content, canonical and matching service offers', async (t) => {
  const request = await server(t);
  const response = await request('/prezentacije/izrada?utm_source=test');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.match(html, /<h1>Izrada prezentacije<\/h1>/);
  assert.match(html, /20,00/);
  assert.match(html, /Do 10 slajdova/);
  assert.match(html, /href="https:\/\/www.formapoint.online\/prezentacije\/izrada"/);
  const service = jsonScript(html, 'fp-jsonld')['@graph'].find(
    (item) => item['@type'] === 'Service',
  );
  assert.equal(service.offers.price, '20.00');
  assert.equal(service.offers.priceCurrency, 'EUR');
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.equal(jsonScript(html, 'fp-public-data').services.length, 3);
  const head = await request('/prezentacije/izrada', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
test('packages have current per-package offers and do not imply subscriptions', () => {
  const page = makePage('/administracija/e-posta', fixture());
  const catalog = page.schema.find((item) => item['@type'] === 'Service').hasOfferCatalog;
  assert.equal(catalog['@type'], 'OfferCatalog');
  assert.deepEqual(
    catalog.itemListElement.map((item) => item.price),
    ['70.00', '90.00'],
  );
  assert.match(page.body, /bez automatske obnove/);
  assert.doesNotMatch(page.body, /Arhivirani paket/);
});
test('sitemap contains only public canonical pages and approved content', () => {
  const xml = sitemap(fixture());
  for (const path of [
    '/prezentacije/izrada',
    '/dokumenti/izrada',
    '/administracija/e-posta',
    '/prezentacije',
    '/p/podaci-pruzatelja',
  ])
    assert.ok(xml.includes(`https://www.formapoint.online${path}</loc>`));
  for (const path of [
    '/usluge/izrada',
    '/app',
    '/admin',
    '/registracija',
    '/portfolio',
    'tajni-nacrt',
    'uvjeti-koristenja',
    'skriveno',
  ])
    assert.ok(!xml.includes(`https://www.formapoint.online${path}</loc>`), path);
  const snapshot = fixture();
  snapshot.portfolio.push({
    title: 'Odobreni primjer',
    published: true,
    publication_rights: true,
    scan_status: 'clean',
  });
  assert.ok(sitemap(snapshot).includes('/portfolio</loc>'));
});
test('ambiguous legacy slugs, redirects, unpublished pages and private requests', async (t) => {
  const request = await server(t);
  assert.equal((await request('/usluge/e-posta')).status, 308);
  assert.equal(
    (await request('/usluge/e-posta')).headers.get('location'),
    '/administracija/e-posta',
  );
  const ambiguous = await request('/usluge/izrada');
  assert.equal(ambiguous.status, 200);
  assert.match(ambiguous.headers.get('x-robots-tag'), /noindex/);
  for (const path of [
    '/admin/korisnici',
    '/app/narudzbe',
    '/prijava',
    '/p/tajni-nacrt',
    '/uvjeti-koristenja',
    '/ne-postoji',
  ]) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.doesNotMatch(await response.text(), /Ne smije se objaviti|Neodobren sadržaj/);
  }
  assert.equal((await request('/', { method: 'POST' })).status, 405);
});
test('preview deployments remain non-indexable and verification tokens are escaped', async (t) => {
  const request = await server(t, {
    environment: {
      VERCEL_ENV: 'preview',
      GOOGLE_SITE_VERIFICATION: 'public-token"/><script>bad()</script>',
      BING_SITE_VERIFICATION: 'bing-token',
    },
  });
  const response = await request('/');
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  const html = await response.text();
  assert.match(html, /data-fp-preview="true"/);
  assert.match(html, /name="robots" content="noindex,follow"/);
  assert.match(html, /name="msvalidate.01" content="bing-token"/);
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
});
test('source failures return retryable 503 instead of stale prices or indexable errors', async (t) => {
  const request = await server(t, {
    load: async () => {
      throw Error('private diagnostic');
    },
  });
  const response = await request('/cjenik');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.doesNotMatch(await response.text(), /private diagnostic/);
});
test('stored text and bootstrap JSON cannot break out into executable HTML', () => {
  const data = fixture();
  data.services[0].name = "</script><img src=x onerror=alert(1)> $& $` $'";
  const html = renderHtml(template, makePage('/prezentacije/izrada', data), data);
  assert.doesNotMatch(html, /<img src=x/);
  assert.equal(jsonScript(html, 'fp-public-data').services[0].name, data.services[0].name);
  assert.doesNotMatch(safeJson({ text: '\u2028</script>' }), /<\/script>|\u2028/);
  for (const path of ['//evil.test', '/%2fadmin', '/%5cfoo', '/%00', '/a/%2e%2e/b', '/%zz'])
    assert.equal(cleanPath(path), null, path);
});
test('loader uses only anon access and strips private/unpublished data', async () => {
  const calls = [];
  const responses = {
    'rpc/refresh_service_prices': null,
    services: [
      {
        id: 'service-1',
        name: 'Izrada',
        slug: 'izrada',
        category: 'Prezentacije',
        active: true,
        price_cents: 2000,
        private_note: 'hidden',
      },
    ],
    site_settings: [
      {
        id: true,
        public_contact_email: 'info@example.test',
        secret: 'hidden',
        payment_icons: { visa: 'https://example.test/visa.png', bad: 'javascript:alert(1)' },
      },
    ],
    content_pages: [
      { slug: 'draft', content: 'hidden', published: false },
      { slug: 'public', content: 'public', published: true, approved_by: 'private-user-id' },
    ],
    portfolio_items: [
      {
        published: true,
        publication_rights: true,
        scan_status: 'clean',
        file_path: 'private-path',
        title: 'Public',
      },
    ],
    payment_methods: [],
  };
  const data = await loadPublicSnapshot(
    { url: 'https://example.test', key: 'anon-test' },
    async (url, options) => {
      const path = new URL(url).pathname.replace('/rest/v1/', '');
      calls.push(path);
      assert.equal(options.headers.Authorization, 'Bearer anon-test');
      return new Response(JSON.stringify(responses[path.split('?')[0]]));
    },
  );
  assert.equal(calls[0], 'rpc/refresh_service_prices');
  assert.deepEqual(calls.map((path) => path.split('?')[0]).sort(), Object.keys(responses).sort());
  const json = JSON.stringify(data);
  assert.doesNotMatch(json, /hidden|private-user-id|private-path|javascript:/);
  assert.equal(data.pages.length, 1);
  assert.equal(data.settings.payment_icons.visa, 'https://example.test/visa.png');
  const jwt = (role) =>
    `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.equal(
    publicConfig({}, { url: 'https://example.test', publishableKey: jwt('anon') }).url,
    'https://example.test',
  );
  assert.throws(() =>
    publicConfig({}, { url: 'https://example.test', publishableKey: jwt('service_role') }),
  );
  assert.throws(() =>
    publicConfig(
      { VITE_SUPABASE_URL: 'https://example.test' },
      { url: 'https://fallback.test', publishableKey: jwt('anon') },
    ),
  );
});
test('Vercel serves root through the public handler and private SPA routes before filesystem fallback', async () => {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url)));
  assert.equal(config.routes[0].dest, '/api/public?path=/');
  assert.ok(
    config.routes.findIndex((route) => route.headers?.['X-Robots-Tag']) <
      config.routes.findIndex((route) => route.handle === 'filesystem'),
  );
  assert.equal(config.functions['api/public.js'].includeFiles, 'dist/index.html');
});

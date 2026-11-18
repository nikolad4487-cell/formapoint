import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import project from '../src/config/supabase.public.json' with { type: 'json' };
import { catalog } from '../src/lib/catalog.ts';
import { faqs } from '../src/lib/public-faqs.ts';
import { publicPages, siteOrigin } from '../src/lib/seo.ts';
import { servicePath } from '../src/lib/service-links.ts';
import { resolveSupabaseConfig } from '../src/lib/supabase-config.ts';

const { url, key, configured } = resolveSupabaseConfig(process.env, project);
const db = configured
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
      },
    })
  : null;

const legalPages = new Map([
  ['/uvjeti-koristenja', 'Uvjeti korištenja'],
  ['/pravila-privatnosti', 'Pravila privatnosti'],
  ['/kolacici', 'Kolačići i lokalna pohrana'],
  ['/otkazivanje-i-povrati', 'Otkazivanje i povrati'],
  ['/prigovori', 'Prigovori'],
]);
const cmsOverrides = new Set([
  '/cjenik',
  '/faq',
  '/kako-funkcionira',
  '/o-nama',
  ...legalPages.keys(),
]);
const accountPages = new Map([
  ['/prijava', 'Prijava'],
  ['/registracija', 'Registracija'],
  ['/kupnja-kao-gost', 'Kupnja kao gost'],
  ['/zaboravljena-lozinka', 'Zaboravljena lozinka'],
  ['/reset-lozinke', 'Postavljanje lozinke'],
  ['/potvrda-emaila', 'Potvrda e-maila'],
  ['/odjava-newslettera', 'Odjava s newslettera'],
]);
const navLinks = [
  ['/', 'FormaPoint'],
  ['/usluge', 'Usluge'],
  ['/cjenik', 'Cjenik'],
  ['/kako-funkcionira', 'Kako funkcionira'],
  ['/o-nama', 'O nama'],
  ['/faq', 'Česta pitanja'],
  ['/kontakt', 'Kontakt'],
];
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
const link = (href, text) => `<a href="${escape(href)}">${escape(text)}</a>`;
const list = (items) => `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
const paragraphs = (value) =>
  value
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => `<p>${escape(paragraph)}</p>`)
    .join('');
const snippet = (value) => value.replace(/\s+/g, ' ').trim().slice(0, 155);
const branded = (title) => `${title} | FormaPoint`;

async function services(slug) {
  if (!db) return slug ? catalog.filter((service) => service.slug === slug) : catalog;
  let query = db
    .from('services')
    .select('slug,name,category,description,included,service_categories(slug)')
    .eq('active', true)
    .order('sort_order');
  if (slug) query = query.eq('slug', slug);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(({ service_categories, ...service }) => ({
    ...service,
    category_slug: service_categories?.slug,
  }));
}

async function cmsPages(slug) {
  if (!db) return [];
  let query = db
    .from('content_pages')
    .select(slug ? 'slug,title,content' : 'slug')
    .eq('published', true);
  if (slug) query = query.eq('slug', slug).limit(1);
  const { data, error } = await query;
  if (error?.code === 'PGRST205') return [];
  if (error) throw error;
  return data;
}

async function portfolio() {
  if (!db) return [];
  const { data, error } = await db
    .from('portfolio_items')
    .select('title,description')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error?.code === 'PGRST205') return [];
  if (error) throw error;
  return data;
}

const serviceLinks = (items) =>
  list(items.map((service) => link(servicePath(service), service.name)));
const pagePath = (slug) =>
  cmsOverrides.has(`/${slug}`) ? `/${slug}` : `/p/${encodeURIComponent(slug)}`;
const cmsContent = ({ title, content }) => ({
  title: branded(title),
  heading: title,
  description: snippet(content),
  body: paragraphs(content),
  indexable: true,
});

async function sitemap() {
  const [items, pages, examples] = await Promise.all([services(), cmsPages(), portfolio()]);
  const paths = new Set([
    ...Object.keys(publicPages).filter((path) => path !== '/portfolio' || examples.length),
    ...items.map(servicePath),
    ...pages.map(({ slug }) => pagePath(slug)),
  ]);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...paths]
      .sort()
      .map((path) => `  <url><loc>${escape(siteOrigin + path)}</loc></url>\n`)
      .join('') +
    '</urlset>\n'
  );
}

async function listedPage(path) {
  const page = Object.hasOwn(publicPages, path) ? publicPages[path] : null;
  const legalTitle = legalPages.get(path);
  if (cmsOverrides.has(path)) {
    const [published] = await cmsPages(path.slice(1));
    if (published) return cmsContent(published);
  }
  if (legalTitle) return { title: branded(legalTitle), heading: legalTitle };
  let body = paragraphs(page.description);
  if (path === '/' || path === '/usluge') {
    // A temporary catalogue outage should leave the homepage and its navigation reachable.
    const items = path === '/' ? await services().catch(() => []) : await services();
    if (items.length) body += serviceLinks(items);
  }
  if (path === '/o-nama') {
    body += paragraphs(
      'Poslovni podaci pružatelja bit će objavljeni nakon provjere i konfiguracije. Platforma još nije otvorena za produkcijsko poslovanje.',
    );
  }
  if (path === '/cjenik') body += `<p>${link('/usluge', 'Pregledaj katalog usluga')}</p>`;
  if (path === '/faq') {
    body += faqs
      .map(([question, answer]) => `<h2>${escape(question)}</h2>${paragraphs(answer)}`)
      .join('');
  }
  if (path === '/portfolio') {
    const examples = await portfolio();
    body += examples
      .map(
        (item) =>
          `<article><h2>${escape(item.title)}</h2>${paragraphs(item.description || '')}</article>`,
      )
      .join('');
    return { ...page, body, indexable: examples.length > 0 };
  }
  return { ...page, body, indexable: true };
}

function documentHtml(template, path, { title, heading, description = '', body, indexable }) {
  const canonical = siteOrigin + path;
  const metadata = [
    `<title>${escape(title)}</title>`,
    description && `<meta name="description" content="${escape(description)}">`,
    indexable && `<link rel="canonical" href="${escape(canonical)}">`,
    !indexable && '<meta name="robots" content="noindex,follow">',
    indexable && '<meta property="og:type" content="website">',
    indexable && '<meta property="og:locale" content="hr_HR">',
    indexable && '<meta property="og:site_name" content="FormaPoint">',
    indexable && `<meta property="og:url" content="${escape(canonical)}">`,
    indexable && `<meta property="og:title" content="${escape(title)}">`,
    indexable && `<meta property="og:description" content="${escape(description)}">`,
    path === '/' &&
      '<script type="application/ld+json">' +
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'FormaPoint',
          url: canonical,
        }) +
        '</script>',
  ]
    .filter(Boolean)
    .join('\n    ');
  const content = heading
    ? `<nav aria-label="Glavna navigacija">${navLinks.map(([href, text]) => link(href, text)).join(' · ')}</nav>` +
      `<main class="container section"><h1>${escape(heading)}</h1>${body || ''}</main>`
    : '';
  return template
    .replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, () => metadata)
    .replace('<div id="root"></div>', () => `<div id="root">${content}</div>`);
}

function sendDocument(res, path, page, status = 200) {
  const template = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf8');
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!page.indexable) res.setHeader('X-Robots-Tag', 'noindex, follow');
  res.end(documentHtml(template, path, page));
}

function notFound(res, path) {
  sendDocument(
    res,
    path,
    {
      title: branded('Stranica nije pronađena'),
      heading: 'Stranica nije pronađena',
      body: paragraphs('Stranica koju tražite nije dostupna ili je premještena.'),
    },
    404,
  );
}

function redirect(res, destination, requestUrl) {
  requestUrl.searchParams.delete('__seo_path');
  res.statusCode = 308;
  res.setHeader('Location', destination + requestUrl.search);
  res.end();
}

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || '/', siteOrigin);
  const rewrittenPath = requestUrl.searchParams.getAll('__seo_path').at(-1);
  const rawPath = rewrittenPath?.startsWith('/') ? rewrittenPath : requestUrl.pathname;
  const path = rawPath.replace(/\/+$/, '') || '/';
  const lower = path.toLowerCase();

  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET, HEAD');
      res.end();
      return;
    }
    if (path === '/sitemap.xml') {
      const xml = await sitemap();
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.end(xml);
      return;
    }
    const accountTitle =
      accountPages.get(lower) ||
      (/^\/(?:app|admin)(?:\/|$)/.test(lower) ? 'Moj radni prostor' : null);
    if (accountTitle) return sendDocument(res, path, { title: branded(accountTitle) });

    if (Object.hasOwn(publicPages, lower) || legalPages.has(lower)) {
      if (rawPath !== lower) return redirect(res, lower, requestUrl);
      return sendDocument(res, path, await listedPage(path));
    }

    const parts = path.split('/').slice(1);
    if (parts.length !== 2) return notFound(res, path);
    let group, slug;
    try {
      [group, slug] = parts.map(decodeURIComponent);
    } catch {
      return notFound(res, path);
    }
    if (!group || !slug || /[/\\\x00-\x1f]/.test(group + slug)) return notFound(res, path);

    if (group.toLowerCase() === 'p') {
      const [page] = await cmsPages(slug);
      if (!page) return notFound(res, path);
      const canonical = pagePath(slug);
      if (rawPath !== canonical) return redirect(res, canonical, requestUrl);
      return sendDocument(res, canonical, cmsContent(page));
    }

    const matches = await services(slug);
    const legacy = group.toLowerCase() === 'usluge';
    if (legacy && matches.length > 1) {
      return sendDocument(res, path, {
        title: branded('Odaberite kategoriju artikla'),
        heading: 'Odaberite kategoriju artikla',
        body: serviceLinks(matches),
      });
    }
    const current = legacy
      ? matches[0]
      : matches.find(
          (service) =>
            servicePath(service) === `/${encodeURIComponent(group)}/${encodeURIComponent(slug)}`,
        );
    if (!current) return notFound(res, path);
    const canonical = servicePath(current);
    if (rawPath !== canonical) return redirect(res, canonical, requestUrl);
    return sendDocument(res, canonical, {
      title: branded(current.name),
      heading: current.name,
      description: snippet(current.description),
      body:
        paragraphs(current.description) +
        '<h2>Što je uključeno</h2>' +
        list(current.included.map(escape)),
      indexable: true,
    });
  } catch (error) {
    console.error('Unable to load public FormaPoint content', error?.code || error?.name);
    res.statusCode = 503;
    res.setHeader('Retry-After', '60');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Sadržaj je privremeno nedostupan. Pokušajte ponovno za minutu.');
  }
}

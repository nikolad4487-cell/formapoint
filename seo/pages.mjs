import { monthlyPackageTerms } from './package-prices-2027.mjs';
import { announcedPrice, announcedPackages } from './announced-prices.mjs';
import { buySteps, faqs, legalSlugs, publicPages, servicePreparation } from './content.mjs';
export const SITE_ORIGIN = 'https://www.formapoint.online';
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const safeJson = (value) =>
  JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
const money = (value) =>
  new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(value / 100);
const plain = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function categorySlug(service) {
  return (
    service.category_slug ||
    String(service.category || '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}
export function servicePath(service) {
  return `/${encodeURIComponent(categorySlug(service))}/${encodeURIComponent(service.slug)}`;
}
export function normaliseServices(rows, packages = []) {
  return rows
    .filter((s) => s.active !== false)
    .map((s) => {
      const variants = packages
        .filter((p) => p.service_id === s.id && p.active !== false && !p.archived)
        .map((p) => ({
          id: p.id,
          service_id: p.service_id,
          name: p.name,
          description: p.description || '',
          price_cents: p.price_cents,
          period: p.period || 'one_time',
          active: true,
          archived: false,
          sort_order: p.sort_order || 0,
        }));
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        description: s.description || '',
        category: s.category,
        category_slug: s.category_slug || s.service_categories?.slug || categorySlug(s),
        icon: s.icon,
        unit_label: s.unit_label,
        delivery_days: s.delivery_days,
        revisions: s.revisions,
        split_enabled: s.split_enabled,
        split_min_cents: s.split_min_cents,
        active: true,
        popular: s.popular || false,
        included: s.included || [],
        excluded: s.excluded || [],
        packages_enabled: Boolean(s.packages_enabled),
        packages: variants,
        price_cents: s.packages_enabled
          ? variants.length
            ? Math.min(...variants.map((p) => p.price_cents))
            : null
          : s.price_cents,
      };
    });
}
export function isPrivatePath(path) {
  return (
    /^\/(?:app|admin|api)(?:\/|$)/.test(path) ||
    /^\/(?:prijava|registracija|kupnja-kao-gost|zaboravljena-lozinka|reset-lozinke|potvrda-emaila|odjava-newslettera|dizajn-sustav)(?:\/|$)/.test(
      path,
    )
  );
}
export function cleanPath(input) {
  const raw = String(input || '/')
    .split('?')[0]
    .split('#')[0];
  if (
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    /[\\\u0000-\u0020]/.test(raw) ||
    /%2f|%5c/i.test(raw)
  )
    return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (
      /[\\\u0000-\u0020]/.test(decoded) ||
      decoded.split('/').some((x) => x === '.' || x === '..')
    )
      return null;
  } catch {
    return null;
  }
  return raw.length > 1 ? raw.replace(/\/+$/, '') : '/';
}
const periods = { one_time: 'Jednokratno', week: 'Tjedni paket', month: 'Mjesečni paket' };
const p = (text) => `<p>${escapeHtml(text)}</p>`;
const list = (items) => `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
const priceNotice = (service) => {
  const packages = announcedPackages(service);
  if (packages.length)
    return `<div class="announced-price"><p>Cijene paketa od 1.1.2027.</p><ul>${packages.map((item) => `<li>${escapeHtml(item.name)} – ${escapeHtml(money(item.price_cents))}</li>`).join('')}</ul><p>${escapeHtml(monthlyPackageTerms)}</p></div>`;
  const label = announcedPrice(service);
  return label ? `<p class="announced-price">${escapeHtml(label)}</p>` : '';
};
const link = (path, title) => `<a href="${escapeHtml(path)}">${escapeHtml(title)}</a>`;
const cmsPath = (slug) =>
  Object.hasOwn(publicPages, `/${slug}`) || legalSlugs.includes(slug)
    ? `/${slug}`
    : `/p/${encodeURIComponent(slug)}`;
function cards(services) {
  return `<div class="service-grid">${services.map((s) => `<article class="service-card"><h2>${link(servicePath(s), s.name)}</h2>${p(s.description)}${p(s.packages_enabled ? (s.price_cents === null ? 'Paketi trenutačno nisu dostupni.' : `Paketi od ${money(s.price_cents)}`) : s.price_cents === null ? 'Cijena prema individualnoj ponudi.' : money(s.price_cents))}${priceNotice(s)}${link(servicePath(s), s.packages_enabled ? 'Odaberite paket' : 'Detalji usluge')}</article>`).join('')}</div>`;
}
function faqBody() {
  return faqs
    .map(
      ([question, answer]) =>
        `<details><summary>${escapeHtml(question)}</summary>${p(answer)}</details>`,
    )
    .join('');
}
function orgSchema(settings) {
  return {
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: 'FormaPoint',
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/favicon.svg`,
    ...(settings.public_contact_email ? { email: settings.public_contact_email } : {}),
    ...(settings.contact_phone ? { telephone: settings.contact_phone } : {}),
    sameAs: [settings.facebook_url, settings.instagram_url, settings.linkedin_url]
      .map(safeUrl)
      .filter(Boolean),
  };
}
function offer(service, variant) {
  const price = variant ? variant.price_cents : service.price_cents;
  if (!Number.isInteger(price) || price < 100) return null;
  return {
    '@type': 'Offer',
    name: variant ? `${service.name} — ${variant.name}` : service.name,
    price: (price / 100).toFixed(2),
    priceCurrency: 'EUR',
    url: `${SITE_ORIGIN}${servicePath(service)}${variant ? `#paket-${variant.id}` : ''}`,
    ...(variant
      ? {
          description:
            `${variant.description} ${periods[variant.period] || 'Jednokratno'}. Jednokratna kupnja bez automatske obnove.`.trim(),
        }
      : {}),
  };
}
export function makePage(input, snapshot = {}) {
  const path = cleanPath(input),
    services = (snapshot.services || []).filter((service) => service.active !== false),
    settings = snapshot.settings || {};
  const pages = (snapshot.pages || []).filter(
    (page) => page.published && (!page.is_legal || page.approved_at),
  );
  const portfolio = (snapshot.portfolio || []).filter(
    (item) =>
      item.published && item.publication_rights && ['clean', 'linked'].includes(item.scan_status),
  );
  const base = {
    status: 200,
    indexable: true,
    canonical: `${SITE_ORIGIN}${path || '/'}`,
    title: 'FormaPoint',
    heading: 'FormaPoint',
    description: '',
    body: '',
    schema: [],
  };
  if (!path || isPrivatePath(path))
    return {
      ...base,
      status: 404,
      indexable: false,
      canonical: null,
      heading: 'Stranica nije pronađena',
      title: 'Stranica nije pronađena | FormaPoint',
      body: p('Za ovu stranicu otvorite aplikaciju.'),
    };
  let breadcrumbs = [{ name: 'Početna', path: '/' }];
  const cms = pages.find((page) => cmsPath(page.slug) === path);
  if (cms) {
    Object.assign(base, {
      title: `${cms.title} | FormaPoint`,
      heading: cms.title,
      description: plain(cms.content).slice(0, 160),
      body: `<div class="prose-text">${escapeHtml(cms.content)}</div>`,
    });
    breadcrumbs.push({ name: cms.title, path });
  } else if (Object.hasOwn(publicPages, path)) {
    Object.assign(base, publicPages[path]);
    base.body = p(base.description);
    if (path === '/' || path === '/usluge' || path === '/cjenik') {
      base.body += cards(services);
      base.body += `<h2>Što pripremiti prije narudžbe?</h2>${p('Opišite zadatak, priložite postojeće materijale i navedite željeni rok. Opseg i dostupnost potvrđuju se prije početka rada. Za usluge s paketima usporedite njihov sadržaj i cijenu.')}${link('/kako-funkcionira', 'Kako funkcionira naručivanje')}`;
      if (path === '/') base.body += `<h2>Česta pitanja</h2>${faqBody()}`;
    }
    if (path === '/faq') {
      base.body += faqBody();
      base.schema.push({
        '@type': 'FAQPage',
        mainEntity: faqs.map(([name, text]) => ({
          '@type': 'Question',
          name,
          acceptedAnswer: { '@type': 'Answer', text },
        })),
      });
    }
    if (path === '/kako-funkcionira')
      base.body += buySteps
        .map(
          ([name, text], i) =>
            `<section><h2>${i + 1}. ${escapeHtml(name)}</h2>${p(text)}</section>`,
        )
        .join('');
    if (path === '/o-nama')
      base.body += p(
        'Cilj FormaPointa je pregledan dogovor: od odabira usluge i opisa zadatka do komunikacije, plaćanja i isporuke. Pregledajte javne podatke pružatelja i javite se za pitanja o opsegu usluge.',
      );
    if (path === '/kontakt' || path === '/o-nama') {
      if (settings.public_contact_email)
        base.body += p(`Kontakt: ${settings.public_contact_email}`);
      if (settings.contact_phone) base.body += p(`Telefon: ${settings.contact_phone}`);
      const provider = pages.find((page) => page.slug === 'podaci-pruzatelja');
      if (provider) base.body += link(cmsPath(provider.slug), provider.title);
    }
    if (path === '/portfolio') {
      base.indexable = portfolio.length > 0;
      base.body += portfolio.length
        ? portfolio
            .map(
              (item) =>
                `<article><h2>${escapeHtml(item.title)}</h2>${p(item.description)}${safeUrl(item.pdf_url) ? link(safeUrl(item.pdf_url), 'Pogledaj objavljeni primjer') : link('/portfolio', 'Otvori primjer u aplikaciji')}</article>`,
            )
            .join('')
        : p('Primjeri radova prikazuju se nakon odobrenja za javnu objavu.');
    }
    if (path !== '/') breadcrumbs.push({ name: base.heading, path });
  } else {
    const parts = path.slice(1).split('/').map(decodeURIComponent);
    if (parts[0] === 'p' && parts.length === 2) {
      const page = pages.find((item) => item.slug === parts[1]);
      if (page && cmsPath(page.slug) !== path)
        return { ...base, status: 308, redirect: cmsPath(page.slug), indexable: false };
    }
    const category = parts.length === 1 ? services.filter((s) => categorySlug(s) === parts[0]) : [];
    const matches =
      parts.length === 2
        ? services.filter(
            (s) => s.slug === parts[1] && (parts[0] === 'usluge' || categorySlug(s) === parts[0]),
          )
        : [];
    if (category.length) {
      const name = category[0].category;
      base.canonical = `${SITE_ORIGIN}/${encodeURIComponent(categorySlug(category[0]))}`;
      Object.assign(base, {
        heading: name,
        title: `${name} online – usluge i cijene | FormaPoint`,
        description: `Pregledajte FormaPoint usluge u kategoriji ${name}. Usporedite opseg, aktualne cijene i pakete te pošaljite upute za svoj zadatak.`,
        body:
          cards(category) +
          `<h2>Što pripremiti prije narudžbe?</h2>${p('Opišite zadatak, priložite postojeće materijale i navedite željeni rok. Opseg i dostupnost potvrđuju se prije početka rada.')}`,
      });
      breadcrumbs.push({ name: 'Usluge', path: '/usluge' }, { name, path });
    } else if (matches.length && parts[0] === 'usluge') {
      if (matches.length === 1)
        return { ...base, status: 308, redirect: servicePath(matches[0]), indexable: false };
      Object.assign(base, {
        heading: 'Odaberite kategoriju artikla',
        title: 'Odaberite kategoriju artikla | FormaPoint',
        indexable: false,
        canonical: null,
        body: cards(matches),
      });
    } else if (matches.length === 1) {
      const service = matches[0],
        description = plain(service.description);
      base.canonical = `${SITE_ORIGIN}${servicePath(service)}`;
      const variants = (service.packages || []).filter((item) => item.active && !item.archived);
      Object.assign(base, {
        heading: service.name,
        title: `${service.name} – cijena i naručivanje | FormaPoint`,
        description: (
          description ||
          `${service.name} na FormaPointu. Pregledajte opseg usluge, cijenu i uvjete naručivanja.`
        ).slice(0, 160),
        body: p(service.description),
      });
      base.body += `<h2>${service.packages_enabled ? 'Paketi usluge' : 'Cijena usluge'}</h2>`;
      const offers = service.packages_enabled
        ? variants.map((item) => offer(service, item)).filter(Boolean)
        : [offer(service)].filter(Boolean);
      base.body += service.packages_enabled
        ? variants
            .map(
              (item) =>
                `<article id="paket-${escapeHtml(item.id)}" class="service-package"><h3>${escapeHtml(item.name)}</h3>${p(item.description)}${p(`${periods[item.period] || 'Jednokratno'} — ${money(item.price_cents)}`)}${p('Jednokratna kupnja bez automatske obnove.')}${link(path, 'Odaberite ovaj paket u aplikaciji')}</article>`,
            )
            .join('')
        : p(
            service.price_cents === null
              ? 'Cijena prema individualnoj ponudi.'
              : money(service.price_cents),
          );
      base.body += priceNotice(service);
      base.body += `<h2>Što je uključeno</h2>${list(service.included || [])}<h2>Granice usluge</h2>${list(service.excluded || [])}<h2>Što pripremiti prije narudžbe?</h2>${list(servicePreparation(service))}`;
      base.body += p(
        service.delivery_days
          ? `Okvirni rok naveden uz uslugu: ${service.delivery_days} radnih dana. Željeni rok i konačan opseg potvrđuju se prije početka.`
          : 'Rok i konačan opseg prema dogovoru prije početka rada.',
      );
      base.body +=
        p(`Broj uključenih revizija: ${service.revisions ?? 0}.`) +
        link('/kako-funkcionira', 'Kako naručiti i platiti') +
        `<h2>Česta pitanja</h2>${faqBody()}`;
      base.schema.push({
        '@type': 'Service',
        '@id': `${base.canonical}#service`,
        name: service.name,
        description,
        serviceType: service.category,
        url: base.canonical,
        provider: { '@id': `${SITE_ORIGIN}/#organization` },
        areaServed: { '@type': 'Country', name: 'Hrvatska' },
        ...(offers.length
          ? service.packages_enabled
            ? {
                hasOfferCatalog: {
                  '@type': 'OfferCatalog',
                  name: `Paketi: ${service.name}`,
                  itemListElement: offers,
                },
              }
            : { offers: offers[0] }
          : {}),
      });
      breadcrumbs.push(
        { name: 'Usluge', path: '/usluge' },
        { name: service.category, path: `/${categorySlug(service)}` },
        { name: service.name, path },
      );
    } else {
      Object.assign(base, {
        status: 404,
        indexable: false,
        canonical: null,
        heading: 'Stranica nije pronađena',
        title: 'Stranica nije pronađena | FormaPoint',
        description: 'Tražena stranica nije dostupna.',
        body:
          p('Provjerite poveznicu ili pregledajte aktualni katalog usluga.') +
          link('/usluge', 'Pregledaj usluge'),
      });
    }
  }
  if (base.indexable) {
    base.schema.unshift(orgSchema(settings), {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'FormaPoint',
      url: SITE_ORIGIN,
      inLanguage: 'hr-HR',
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    });
    base.schema.push({
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: `${SITE_ORIGIN}${item.path}`,
      })),
    });
  }
  base.body = `<nav class="breadcrumbs" aria-label="Putanja">${breadcrumbs.map((item) => link(item.path, item.name)).join(' / ')}</nav><h1>${escapeHtml(base.heading)}</h1>${base.body}`;
  return base;
}
export function sitemap(snapshot) {
  const paths = new Set(Object.keys(publicPages));
  for (const service of (snapshot.services || []).filter((item) => item.active !== false)) {
    paths.add(servicePath(service));
    paths.add(`/${categorySlug(service)}`);
  }
  for (const page of snapshot.pages || [])
    if (page.published && (!page.is_legal || page.approved_at)) paths.add(cmsPath(page.slug));
  const valid = [...paths].filter((path) => makePage(path, snapshot).indexable);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${valid.map((path) => `<url><loc>${escapeHtml(SITE_ORIGIN + path)}</loc></url>`).join('')}</urlset>`;
}
export function renderHtml(
  template,
  page,
  snapshot,
  { preview = false, googleVerification = '', bingVerification = '' } = {},
) {
  const indexable = page.indexable && !preview;
  const meta = `<meta id="fp-description" name="description" content="${escapeHtml(page.description)}"><meta id="fp-robots" name="robots" content="${indexable ? 'index,follow' : 'noindex,follow'}">${page.canonical ? `<link id="fp-canonical" rel="canonical" href="${escapeHtml(page.canonical)}">` : ''}<meta id="fp-og-title" property="og:title" content="${escapeHtml(page.title)}"><meta id="fp-og-description" property="og:description" content="${escapeHtml(page.description)}"><meta id="fp-og-type" property="og:type" content="website"><meta id="fp-og-url" property="og:url" content="${escapeHtml(page.canonical || SITE_ORIGIN)}"><meta property="og:site_name" content="FormaPoint"><meta property="og:locale" content="hr_HR"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(page.title)}"><meta name="twitter:description" content="${escapeHtml(page.description)}">${googleVerification ? `<meta name="google-site-verification" content="${escapeHtml(googleVerification)}">` : ''}${bingVerification ? `<meta name="msvalidate.01" content="${escapeHtml(bingVerification)}">` : ''}${indexable ? `<script id="fp-jsonld" type="application/ld+json">${safeJson({ '@context': 'https://schema.org', '@graph': page.schema })}</script>` : ''}`;
  const footer = `<footer class="public-footer"><div class="container">${link('/', 'FormaPoint')} · ${link('/kontakt', 'Kontakt')} · ${link('/portfolio', 'Portfolio')}${snapshot.settings?.public_contact_email ? p(snapshot.settings.public_contact_email) : ''}</div></footer>`;
  const body = `<div class="public-shell seo-initial"><header class="public-header"><div class="container header-inner">${link('/', 'FormaPoint')}<nav aria-label="Glavna navigacija">${link('/usluge', 'Usluge')} ${link('/cjenik', 'Cjenik')} ${link('/kako-funkcionira', 'Kako funkcionira')} ${link('/kontakt', 'Kontakt')}</nav></div></header><main class="container section" id="sadrzaj">${page.body}<noscript><p>Za dodavanje u košaricu i kupnju uključite JavaScript. Za upite otvorite ${link('/kontakt', 'kontakt')}.</p></noscript></main>${footer}</div>`;
  return template
    .replace(/<html\b/i, preview ? '<html data-fp-preview="true"' : '<html')
    .replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(page.title)}</title>`)
    .replace(
      /<meta\b[^>]*(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi,
      '',
    )
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace('</head>', () => `${meta}</head>`)
    .replace(
      /<div id="root">\s*<\/div>/,
      () =>
        `<div id="root">${body}</div><script id="fp-public-data" type="application/json">${safeJson({ version: 1, ...snapshot })}</script>`,
    );
}

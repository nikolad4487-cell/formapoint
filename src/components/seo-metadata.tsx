import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '../hooks/use-data';
import { usePublishedPage, useSiteSettings } from '../hooks/use-site-settings';
import { configured, requireDb } from '../lib/supabase';
import type { PortfolioItem } from '../lib/admin-tools';
import { isPrivatePath, makePage, SITE_ORIGIN, type SeoPage } from '../../seo/pages.mjs';
import { legalSlugs, publicPages } from '../../seo/content.mjs';

function meta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}
function applyMetadata(page: SeoPage) {
  const indexable = page.indexable && document.documentElement.dataset.fpPreview !== 'true';
  document.title = page.title;
  meta('name', 'description', page.description);
  meta('name', 'robots', indexable ? 'index,follow' : 'noindex,follow');
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (page.canonical) {
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = page.canonical;
  } else canonical?.remove();
  meta('property', 'og:title', page.title);
  meta('property', 'og:description', page.description);
  meta('property', 'og:url', page.canonical || SITE_ORIGIN);
  meta('property', 'og:type', 'website');
  meta('property', 'og:site_name', 'FormaPoint');
  meta('property', 'og:locale', 'hr_HR');
  meta('name', 'twitter:card', 'summary');
  meta('name', 'twitter:title', page.title);
  meta('name', 'twitter:description', page.description);
  let schema = document.getElementById('fp-jsonld');
  if (indexable && page.schema.length) {
    if (!schema) {
      schema = document.createElement('script');
      schema.id = 'fp-jsonld';
      schema.setAttribute('type', 'application/ld+json');
      document.head.append(schema);
    }
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': page.schema,
    });
  } else schema?.remove();
}
function PrivateMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = pathname.startsWith('/admin')
      ? 'Administracija'
      : pathname.startsWith('/app')
        ? 'Moj radni prostor'
        : {
            '/prijava': 'Prijava',
            '/registracija': 'Registracija',
            '/kupnja-kao-gost': 'Kupnja kao gost',
            '/zaboravljena-lozinka': 'Obnova lozinke',
            '/reset-lozinke': 'Nova lozinka',
            '/odjava-newslettera': 'Odjava s newslettera',
          }[pathname] || 'Korisnički prostor';
    applyMetadata({
      title: `${title} | FormaPoint`,
      description: 'Korisnički prostor FormaPointa.',
      canonical: null,
      indexable: false,
      schema: [],
      status: 200,
      body: '',
      heading: title,
    });
  }, [pathname]);
  return null;
}
function PublicMetadata() {
  const { pathname } = useLocation();
  const services = useServices(),
    settings = useSiteSettings();
  const path = pathname.replace(/\/+$/, '') || '/';
  const slug = path.startsWith('/p/')
    ? path.slice(3)
    : Object.hasOwn(publicPages, path) || legalSlugs.includes(path.slice(1))
      ? path.slice(1)
      : '';
  const page = usePublishedPage(slug);
  const portfolio = useQuery({
    queryKey: ['portfolio_items', 'public'],
    enabled: configured && path === '/portfolio',
    queryFn: async () => {
      const { data, error } = await requireDb()
        .from('portfolio_items')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as PortfolioItem[];
    },
  });
  useEffect(() => {
    const snapshot = {
      services: services.data || [],
      settings: settings.data || {},
      pages: page.data ? [page.data] : [],
      portfolio: portfolio.data || [],
    };
    let document = makePage(path, snapshot);
    if (document.redirect) document = makePage(document.redirect, snapshot);
    applyMetadata(document);
  }, [path, services.data, settings.data, page.data, portfolio.data]);
  return null;
}
export function SeoMetadata() {
  const { pathname } = useLocation();
  return isPrivatePath(pathname) ? <PrivateMetadata /> : <PublicMetadata />;
}

import type { QueryClient } from '@tanstack/react-query';
import type { PublicSnapshot } from '../../seo/pages.mjs';
import { publicPages, legalSlugs } from '../../seo/content.mjs';
export function seedPublicQueries(cache: QueryClient) {
  const element = document.getElementById('fp-public-data');
  if (!element) return;
  try {
    const snapshot = JSON.parse(element.textContent || '') as PublicSnapshot;
    if (
      snapshot.version !== 1 ||
      !Array.isArray(snapshot.services) ||
      !snapshot.settings ||
      !Array.isArray(snapshot.pages)
    )
      return;
    cache.setQueryData(['services'], snapshot.services);
    cache.setQueryData(['site_settings', 'public'], snapshot.settings);
    cache.setQueryData(
      ['payment-availability'],
      Boolean(snapshot.settings.stripe_enabled && !snapshot.settings.maintenance),
    );
    if (snapshot.methods !== undefined)
      cache.setQueryData(['payment_methods', 'public'], snapshot.methods);
    if (Array.isArray(snapshot.portfolio))
      cache.setQueryData(['portfolio_items', 'public'], snapshot.portfolio);
    for (const slug of [
      ...Object.keys(publicPages).map((path) => path.slice(1)),
      ...legalSlugs,
      'podaci-pruzatelja',
    ])
      cache.setQueryData(
        ['content_pages', 'published', slug],
        snapshot.pages.find((page) => page.slug === slug) || null,
      );
    for (const page of snapshot.pages)
      cache.setQueryData(['content_pages', 'published', page.slug], page);
  } catch {
    /* A missing/invalid bootstrap falls back to normal public queries. */
  } finally {
    element.remove();
  }
}

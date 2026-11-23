import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announcedPrice, prices2027, priceList2027StartsAt } from '../seo/announced-prices.mjs';
import { makePage } from '../seo/pages.mjs';
import { catalog } from '../src/lib/catalog';
const service = { ...catalog[0], id: '95d76eb9-11a1-4ab0-a1a7-a5cb133dc002', price_cents: 6000 };
const before = Date.parse('2026-12-31T22:59:59Z');
afterEach(() => vi.useRealTimers());
describe('Najava odobrenog cjenika za 2027.', () => {
  it('svi iznosi za postojeće artikle odgovaraju već zakazanim iznosima nadogradnje 020', () => {
    const sql = readFileSync('supabase/migrations/202611120020_scheduled_prices.sql', 'utf8');
    const seed = Object.fromEntries(
      [...sql.matchAll(/\('([0-9a-f-]+)'::uuid,(\d+)\)/g)].map((match) => [
        match[1],
        Number(match[2]),
      ]),
    );
    expect(prices2027).toEqual(seed);
    expect(
      announcedPrice(
        {
          ...service,
          id: 'new-seminar-id',
          slug: 'seminar',
          category: 'Učenički radovi - osnovna i srednja škola',
        },
        before,
      ),
    ).toContain('30,00');
  });
  it('prikazuje najavu do ponoći u Hrvatskoj, ne do ponoći u preglednikovoj zoni', () => {
    expect(announcedPrice(service, before)).toMatch(/Cijena od 1\.1\.2027\. 80,00\s€/);
    expect(priceList2027StartsAt).toBe(Date.parse('2026-12-31T23:00:00Z'));
    expect(announcedPrice(service, priceList2027StartsAt)).toBeNull();
    expect(announcedPrice(service, priceList2027StartsAt + 1)).toBeNull();
  });
  it('ne izmišlja cijene paketa, administracije, drugih seminara ili neaktivnih artikala', () => {
    expect(announcedPrice({ ...service, packages_enabled: true }, before)).toBeNull();
    expect(announcedPrice({ ...service, active: false }, before)).toBeNull();
    expect(
      announcedPrice(
        { ...service, id: 'other', slug: 'seminar', category: 'Administracija' },
        before,
      ),
    ).toBeNull();
    expect(announcedPrice({ ...service, id: 'other' }, before)).toBeNull();
  });
  it('javna HTML najava ne mijenja trenutačnu cijenu ili Offer podatke za pretraživače', () => {
    vi.useFakeTimers();
    vi.setSystemTime(before);
    const page = makePage(`/${service.category_slug || 'dokumenti'}/${service.slug}`, {
      services: [{ ...service, category_slug: 'dokumenti' }],
    });
    expect(page.body).toContain('Cijena od 1.1.2027.');
    expect(page.body).toMatch(/80,00/);
    expect(
      (page.schema.find((item) => item['@type'] === 'Service')?.offers as { price: string }).price,
    ).toBe('60.00');
    expect(service.price_cents).toBe(6000);
    vi.setSystemTime(priceList2027StartsAt);
    expect(
      makePage(`/dokumenti/${service.slug}`, {
        services: [{ ...service, category_slug: 'dokumenti' }],
      }).body,
    ).not.toContain('Cijena od 1.1.2027.');
  });
});

it('najava pet paketa prikazuje odobrene cijene i nestaje na početku 2027.', async () => {
  const { announcedPackages } = await import('../seo/announced-prices.mjs');
  const { packagePlans2027, monthlyPackageTerms } = await import('../seo/package-prices-2027.mjs');
  const email = { ...service, id: '958b7acd-8f18-4a93-a723-406c294cefa2' };
  const admin = { ...service, id: '0433f0e6-54ee-44fd-bbc2-842f492764c4' };
  expect(announcedPackages(email, before).map((p) => p.price_cents)).toEqual([7000, 9000, 35000]);
  expect(announcedPackages(admin, before).map((p) => p.price_cents)).toEqual([30000, 130000]);
  expect(announcedPackages(email, before)[1].description).toContain('ukupno 15 sati');
  expect(announcedPackages(admin, before)[0].description).toContain('ukupno 20 sati');
  expect(
    packagePlans2027
      .flatMap((plan) => plan.packages)
      .filter((p) => p.period === 'month')
      .every((p) => p.description.includes(monthlyPackageTerms)),
  ).toBe(true);
  expect(announcedPackages({ ...email, packages_enabled: true }, before)).toHaveLength(3);
  expect(announcedPackages(email, priceList2027StartsAt)).toEqual([]);
  expect(announcedPackages({ ...admin, active: false }, before)).toEqual([]);
  expect(announcedPackages(service, before)).toEqual([]);
});

it('HTML najava paketa ne objavljuje buduće cijene kao trenutačne ponude', () => {
  vi.useFakeTimers();
  vi.setSystemTime(before);
  const admin = {
    ...service,
    id: '0433f0e6-54ee-44fd-bbc2-842f492764c4',
    category_slug: 'administracija',
    slug: 'admin',
    packages_enabled: false,
    price_cents: 5000,
  };
  const page = makePage('/administracija/admin', { services: [admin] });
  expect(page.body).toContain('Cijene paketa od 1.1.2027.');
  expect(page.body).toContain('1.300,00');
  expect(page.body).toContain('Blagdani i drugi neradni dani');
  expect(
    (page.schema.find((item) => item['@type'] === 'Service')?.offers as { price: string }).price,
  ).toBe('50.00');
});

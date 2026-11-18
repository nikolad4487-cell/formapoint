import { normaliseServices } from '../../seo/pages.mjs';
export function fixture() {
  const services = normaliseServices(
    [
      {
        id: 'service-1',
        name: 'Izrada prezentacije',
        slug: 'izrada',
        category: 'Prezentacije',
        category_slug: 'prezentacije',
        description: 'Prezentacija prema vašim uputama.',
        active: true,
        price_cents: 2000,
        included: ['Do 10 slajdova'],
        excluded: ['Dodatni slajdovi'],
        revisions: 2,
        delivery_days: 5,
      },
      {
        id: 'service-2',
        name: 'Uređenje dokumenta',
        slug: 'izrada',
        category: 'Dokumenti',
        category_slug: 'dokumenti',
        active: true,
        price_cents: 3000,
        description: 'Uređenje postojećeg dokumenta.',
      },
      {
        id: 'service-3',
        name: 'Upravljanje e-poštom',
        slug: 'e-posta',
        category: 'Administracija',
        category_slug: 'administracija',
        active: true,
        packages_enabled: true,
        description: 'Odaberite opseg administrativne pomoći.',
      },
      {
        id: 'hidden-service',
        name: 'Neaktivna usluga',
        slug: 'skriveno',
        category: 'Dokumenti',
        active: false,
        price_cents: 1000,
      },
    ],
    [
      {
        id: 'variant-1',
        service_id: 'service-3',
        name: 'Paket 1',
        description: '4 sata podrške',
        price_cents: 7000,
        period: 'one_time',
        active: true,
      },
      {
        id: 'variant-2',
        service_id: 'service-3',
        name: 'Paket 2',
        description: '5 sati podrške',
        price_cents: 9000,
        period: 'week',
        active: true,
      },
      {
        id: 'hidden-package',
        service_id: 'service-3',
        name: 'Arhivirani paket',
        price_cents: 100,
        active: true,
        archived: true,
      },
    ],
  );
  return {
    services,
    settings: {
      public_contact_email: 'info@example.test',
      stripe_enabled: false,
      maintenance: false,
    },
    pages: [
      {
        id: 'cms-1',
        slug: 'podaci-pruzatelja',
        title: 'Podaci pružatelja',
        content: 'Javno objavljeni podaci.',
        published: true,
        is_legal: false,
      },
      {
        id: 'cms-2',
        slug: 'tajni-nacrt',
        title: 'Tajni nacrt',
        content: 'Ne smije se objaviti',
        published: false,
      },
      {
        id: 'cms-3',
        slug: 'uvjeti-koristenja',
        title: 'Neodobreni pravni tekst',
        content: 'Neodobren sadržaj',
        published: true,
        is_legal: true,
      },
    ].filter((page) => page.published && (!page.is_legal || page.approved_at)),
    portfolio: [],
    methods: [],
  };
}
export const template =
  '<!doctype html><html lang="hr"><head><meta charset="UTF-8"><title>Stari naslov</title><meta name="description" content="Stari opis"><meta name="robots" content="noindex,follow"></head><body><div id="root"></div></body></html>';

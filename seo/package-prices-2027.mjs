export const monthlyPackageTerms =
  'Mjesečni paketi imaju fiksnu cijenu neovisno o broju radnih dana u mjesecu. Blagdani i drugi neradni dani uređuju se prema dogovoru.';
export const packagePlans2027 = [
  {
    service_id: '958b7acd-8f18-4a93-a723-406c294cefa2',
    service_name: 'Upravljanje i vođenje e-pošte',
    packages: [
      {
        id: '20270101-0007-4000-8000-000000000001',
        name: 'Jednokratno (do 4 sata)',
        description: 'Jednokratno upravljanje i vođenje e-pošte, do 4 sata rada.',
        price_cents: 7000,
        period: 'one_time',
      },
      {
        id: '20270101-0007-4000-8000-000000000002',
        name: 'Tjedno (3 sata dnevno, 5 dana)',
        description:
          'Upravljanje i vođenje e-pošte: 3 sata dnevno, 5 dana u tjednu, ukupno 15 sati.',
        price_cents: 9000,
        period: 'week',
      },
      {
        id: '20270101-0007-4000-8000-000000000003',
        name: 'Mjesečno (4 sata dnevno, ponedjeljak – petak)',
        description: `Upravljanje i vođenje e-pošte: 4 sata dnevno, ponedjeljak – petak. ${monthlyPackageTerms}`,
        price_cents: 35000,
        period: 'month',
      },
    ],
  },
  {
    service_id: '0433f0e6-54ee-44fd-bbc2-842f492764c4',
    service_name: 'Online administracija',
    packages: [
      {
        id: '20270101-0008-4000-8000-000000000001',
        name: 'Online administracija – tjedna',
        description: '4 sata dnevno, 5 dana u tjednu, ukupno 20 sati.',
        price_cents: 30000,
        period: 'week',
      },
      {
        id: '20270101-0009-4000-8000-000000000001',
        name: 'Online administracija – mjesečna',
        description: `4 sata dnevno, ponedjeljak – petak. ${monthlyPackageTerms}`,
        price_cents: 130000,
        period: 'month',
      },
    ],
  },
];

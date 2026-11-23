import { test, expect, type Page } from '@playwright/test';
import { fixtureServices, workspaceFixture } from '../fixtures/workspace';

async function packageFixture(page: Page, signedIn = true) {
  await workspaceFixture(page, { admin: true, signedIn, stripe: true });
  let service = { ...fixtureServices[0], packages_enabled: false };
  let packages: any[] = [];
  let saved: any;
  let cart: any[] = [];
  let added: any;
  await page.route('**/rest/v1/services**', (route) => route.fulfill({ json: [service] }));
  await page.route('**/rest/v1/service_variants**', (route) => route.fulfill({ json: packages }));
  await page.route('**/rest/v1/rpc/save_service_packages', (route) => {
    saved = route.request().postDataJSON();
    service = { ...service, packages_enabled: saved.p_enabled };
    packages = saved.p_packages.map((p: any, i: number) => ({
      ...p,
      service_id: service.id,
      archived: false,
      sort_order: i,
    }));
    return route.fulfill({ json: null });
  });
  await page.route('**/rest/v1/cart_items**', (route) => route.fulfill({ json: cart }));
  await page.route('**/rest/v1/rpc/cart_add_variant', (route) => {
    added = route.request().postDataJSON();
    cart = [
      {
        id: 'selected-package-cart',
        service_id: service.id,
        variant_id: added.p_variant,
        quantity: added.p_quantity,
        services: service,
      },
    ];
    return route.fulfill({ json: null });
  });
  await page.route('**/rest/v1/rpc/cart_pricing', (route) => {
    const total = cart.reduce(
      (sum, item) =>
        sum + item.quantity * packages.find((p) => p.id === item.variant_id).price_cents,
      0,
    );
    return route.fulfill({
      json: { subtotal: total, total, discount: 0, split: false, count: cart.length },
    });
  });
  return {
    service,
    saved: () => saved,
    added: () => added,
    seed: () => {
      service = { ...service, packages_enabled: true };
      packages = [
        {
          id: 'b1900000-0000-4000-8000-000000000011',
          service_id: service.id,
          name: 'Mjesečni paket',
          description: 'Mjesečna usluga',
          price_cents: 35000,
          period: 'month',
          active: true,
          archived: false,
          sort_order: 0,
        },
      ];
    },
  };
}

test('administrator sprema tri paketa, kupac odabire paket i košarica koristi njegovu cijenu', async ({
  page,
}, testInfo) => {
  const fixture = await packageFixture(page);
  await page.goto('/admin/usluge');
  await page.getByRole('button', { name: 'Paketi', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Paketi: ${fixture.service.name}` });
  for (const [index, price] of ['70', '90', '350'].entries()) {
    await dialog.getByRole('button', { name: 'Dodaj paket' }).click();
    await dialog.getByLabel('Cijena paketa (€)').nth(index).fill(price);
    await dialog
      .getByLabel('Opis i opseg paketa')
      .nth(index)
      .fill(['Jednokratno 4h tjedno', '5h tjedno', 'Mjesečno upravljanje'][index]);
    await dialog
      .getByLabel('Razdoblje usluge')
      .nth(index)
      .selectOption(['one_time', 'week', 'month'][index]);
  }
  await dialog.getByRole('button', { name: 'Spremi pakete' }).click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.saved()).toMatchObject({ p_service: fixture.service.id, p_enabled: true });
  expect(fixture.saved().p_packages.map((p: any) => p.price_cents)).toEqual([7000, 9000, 35000]);
  await page.goto(`/usluge/${fixture.service.slug}`);
  await expect(page.getByRole('heading', { name: 'Paket 2', exact: true })).toBeVisible();
  const weekly = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Paket 2', exact: true }) });
  await expect(weekly).toContainText('90,00');
  await expect(weekly).toContainText('5h tjedno');
  await page.screenshot({
    path: `/tmp/formapoint-packages-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await weekly.getByRole('button', { name: 'Dodaj u košaricu' }).click();
  await expect.poll(() => fixture.added()?.p_variant).toBe(fixture.saved().p_packages[1].id);
  await page.goto('/app/kosarica');
  await expect(
    page.getByRole('heading', { name: `${fixture.service.name} — Paket 2`, exact: true }),
  ).toBeVisible();
  await expect(page.locator('.cart-total')).toContainText('90,00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('gost odabrani paket zadržava pri prelasku na kontaktni obrazac', async ({ page }) => {
  const fixture = await packageFixture(page, false);
  fixture.seed();
  await page.goto(`/usluge/${fixture.service.slug}`);
  await page.getByRole('button', { name: 'Dodaj u košaricu' }).click();
  await expect(page).toHaveURL(/kupnja-kao-gost\?.*package=b1900000-0000-4000-8000-000000000011/);
  await expect(page.getByRole('heading', { name: 'Kupnja kao gost' })).toBeVisible();
});

test('nespremljeni paketi prežive zatvaranje, osvježavanje i neuspjelo spremanje', async ({
  page,
}) => {
  const fixture = await packageFixture(page);
  let reject = true;
  await page.route('**/rest/v1/rpc/save_service_packages', (route) =>
    reject
      ? route.fulfill({
          status: 400,
          json: { code: 'P0001', message: 'Spremanje nije uspjelo. Pokušajte ponovno.' },
        })
      : route.fallback(),
  );
  await page.goto('/admin/usluge');
  await page.getByRole('button', { name: 'Paketi', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Dodaj paket' }).click();
  await dialog.getByLabel('Naziv paketa').fill('Administracija - tjedni paket');
  await dialog.getByLabel('Cijena paketa (€)').fill('123,45');
  await dialog.getByLabel('Opis i opseg paketa').fill('Pet sati administrativne podrške.');
  await dialog.getByLabel('Razdoblje usluge').selectOption('week');
  await expect(dialog.getByRole('status')).toContainText('još nije spremljen u bazu');
  await dialog.getByRole('button', { name: 'Zatvori', exact: true }).click();
  await page.getByRole('button', { name: 'Paketi', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Cijena paketa (€)')).toHaveValue('123,45');
  await expect(dialog.getByRole('status')).toContainText('Vraćen je nespremljeni nacrt');
  await page.reload();
  await page.getByRole('button', { name: 'Paketi', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Naziv paketa')).toHaveValue('Administracija - tjedni paket');
  await expect(dialog.getByLabel('Cijena paketa (€)')).toHaveValue('123,45');
  await expect(dialog.getByLabel('Razdoblje usluge')).toHaveValue('week');
  await dialog.getByRole('button', { name: 'Spremi pakete', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Spremanje nije uspjelo');
  await expect(dialog.getByLabel('Cijena paketa (€)')).toHaveValue('123,45');
  expect(fixture.saved()).toBeUndefined();
  reject = false;
  await dialog.getByRole('button', { name: 'Spremi pakete', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.saved().p_packages[0]).toMatchObject({
    name: 'Administracija - tjedni paket',
    price_cents: 12345,
    period: 'week',
  });
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.startsWith('fp-package-draft:')),
    ),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Paketi', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Cijena paketa (€)')).toHaveValue('123,45');
  await expect(
    page.getByRole('dialog').getByText('Vraćen je nespremljeni nacrt', { exact: false }),
  ).toHaveCount(0);
});

test('administrator može odbaciti nacrt i ponovno učitati spremljene pakete', async ({ page }) => {
  const fixture = await packageFixture(page);
  fixture.seed();
  await page.goto('/admin/usluge');
  await page.getByRole('button', { name: 'Paketi', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Cijena paketa (€)').fill('999');
  await dialog.getByRole('button', { name: 'Odbaci nacrt' }).click();
  await expect(dialog.getByLabel('Cijena paketa (€)')).toHaveValue('350,00');
  expect(fixture.saved()).toBeUndefined();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.startsWith('fp-package-draft:')),
    ),
  ).toEqual([]);
});

import { test, expect, type Page } from '@playwright/test';
import { fixtureServices, fixtureUser, workspaceFixture } from '../fixtures/workspace';

async function packageFixture(page: Page, signedIn = true) {
  await workspaceFixture(page, { admin: true, signedIn, stripe: true });
  let service = { ...fixtureServices[0], packages_enabled: false };
  let packages: any[] = [];
  let saved: any;
  let cart: any[] = [];
  let added: any;
  let addCount = 0;
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
    addCount++;
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
    addCount: () => addCount,
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

function loginSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: fixtureUser, role: 'authenticated', exp })}.fixture`,
    refresh_token: 'test-only-refresh-token',
    expires_in: 3600,
    expires_at: exp,
    token_type: 'bearer',
    user: {
      id: fixtureUser,
      aud: 'authenticated',
      role: 'authenticated',
      is_anonymous: false,
      email: 'test@example.invalid',
      app_metadata: { provider: 'email' },
      user_metadata: { first_name: 'Test', last_name: 'Korisnik' },
      created_at: '2026-10-01T10:00:00Z',
    },
  };
}

test('prijavljeni korisnik dodaje paket u aplikaciji bez preusmjeravanja i odjave', async ({
  page,
}) => {
  const fixture = await packageFixture(page);
  fixture.seed();
  const signouts: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/auth/v1/logout')) signouts.push(request.url());
  });
  await page.goto('/app/nova-narudzba');
  await expect(page.getByRole('heading', { name: 'Mjesečni paket', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dodaj u košaricu', exact: true }).click();
  await expect.poll(() => fixture.addCount()).toBe(1);
  await expect(page).toHaveURL(/\/app\/nova-narudzba$/);
  await page.getByRole('link', { name: 'Otvori košaricu', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: `${fixture.service.name} — Mjesečni paket`, exact: true }),
  ).toBeVisible();
  await expect(page.locator('.cart-total')).toContainText('350,00');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('sb-127-auth-token')!).user.id),
  ).toBe(fixtureUser);
  await page.goto(`/usluge/${fixture.service.slug}`);
  await expect(
    page.locator('header').getByRole('link', { name: 'Moj račun', exact: false }),
  ).toBeVisible();
  await expect(
    page.locator('header').getByRole('link', { name: 'Prijava', exact: false }),
  ).toHaveCount(0);
  expect(signouts).toEqual([]);
});

for (const mode of ['login', 'register'] as const) {
  test(`gost zadržava odabrani paket kroz ${mode}, osvježavanje stranice i ulazak u košaricu`, async ({
    page,
  }) => {
    const fixture = await packageFixture(page, false);
    fixture.seed();
    await page.route('**/auth/v1/token?grant_type=password', (route) =>
      route.fulfill({ json: loginSession() }),
    );
    await page.route('**/auth/v1/signup', (route) => route.fulfill({ json: loginSession() }));
    await page.goto(`/usluge/${fixture.service.slug}`);
    await page.getByRole('button', { name: 'Dodaj u košaricu', exact: true }).click();
    await expect(page).toHaveURL(/kupnja-kao-gost\?.*package=/);
    await page.getByRole('link', { name: 'Imam račun', exact: true }).click();
    await expect(page).toHaveURL(/prijava\?.*package=b1900000-0000-4000-8000-000000000011/);
    if (mode === 'register')
      await page.getByRole('link', { name: 'Registrirajte se', exact: true }).click();
    await page.reload();
    if (mode === 'register') {
      await page.getByLabel('Ime', { exact: true }).fill('Test');
      await page.getByLabel('Prezime', { exact: true }).fill('Korisnik');
      await page.getByLabel('Potvrda lozinke', { exact: true }).fill('Abcd1234');
      await page.locator('input[name=terms]').check();
    }
    await page.getByLabel('E-mail adresa', { exact: true }).fill('test@example.invalid');
    await page.locator('input[name=password]').fill('Abcd1234');
    await page
      .getByRole('button', {
        name: mode === 'login' ? 'Prijavi se' : 'Kreiraj račun',
        exact: false,
      })
      .click();
    await expect(page).toHaveURL(/\/app\/kosarica$/);
    await expect(
      page.getByRole('heading', { name: `${fixture.service.name} — Mjesečni paket`, exact: true }),
    ).toBeVisible();
    await expect(page.locator('.cart-total')).toContainText('350,00');
    expect(fixture.added()).toMatchObject({
      p_service: fixture.service.id,
      p_variant: 'b1900000-0000-4000-8000-000000000011',
      p_quantity: 1,
    });
    expect(fixture.addCount()).toBe(1);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: `${fixture.service.name} — Mjesečni paket`, exact: true }),
    ).toBeVisible();
    expect(fixture.addCount()).toBe(1);
  });
}

test('gost dovršava kontaktni obrazac s odabranim paketom i zadržava pristup košarici', async ({
  page,
}) => {
  const fixture = await packageFixture(page, false);
  fixture.seed();
  await page.route('**/auth/v1/signup', (route) =>
    route.fulfill({
      json: { ...loginSession(), user: { ...loginSession().user, is_anonymous: true, email: '' } },
    }),
  );
  await page.goto(`/usluge/${fixture.service.slug}`);
  await page.getByRole('button', { name: 'Dodaj u košaricu', exact: true }).click();
  await page.getByLabel('Ime', { exact: true }).fill('Test');
  await page.getByLabel('Prezime', { exact: true }).fill('Gost');
  await page.getByLabel('E-mail', { exact: true }).fill('gost@example.invalid');
  await page.locator('input[name=terms]').check();
  await page.getByRole('button', { name: 'Nastavi kao gost', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/kosarica$/);
  await expect(page.locator('.cart-total')).toContainText('350,00');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: `${fixture.service.name} — Mjesečni paket`, exact: true }),
  ).toBeVisible();
  expect(fixture.addCount()).toBe(1);
});

test('paket se ne preusmjerava gostu dok traje obnova postojeće prijave', async ({ page }) => {
  const fixture = await packageFixture(page);
  fixture.seed();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/rest/v1/user_roles?**', async (route) => {
    await gate;
    await route.fulfill({ json: [{ role: 'ADMIN' }] });
  });
  try {
    await page.goto(`/usluge/${fixture.service.slug}`);
    await expect(
      page.locator('.service-package').getByRole('button', { name: 'Provjera prijave…' }),
    ).toBeDisabled();
    await expect(page).not.toHaveURL(/kupnja-kao-gost|prijava/);
    release();
    await page.getByRole('button', { name: 'Dodaj u košaricu', exact: true }).click();
    await expect.poll(() => fixture.addCount()).toBe(1);
    await expect(page).not.toHaveURL(/kupnja-kao-gost|prijava/);
  } finally {
    release();
  }
});

test('neuspjelo dodavanje nakon prijave zadržava paket i omogućuje ponovni pokušaj', async ({
  page,
}) => {
  const fixture = await packageFixture(page, false);
  fixture.seed();
  let reject = true;
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({ json: loginSession() }),
  );
  await page.route('**/rest/v1/rpc/cart_add_variant', (route) =>
    reject
      ? route.fulfill({
          status: 400,
          json: { code: 'P0001', message: 'Privremena pogreška dodavanja paketa.' },
        })
      : route.fallback(),
  );
  await page.goto(
    `/prijava?service=${fixture.service.id}&quantity=1&package=b1900000-0000-4000-8000-000000000011`,
  );
  await page.getByLabel('E-mail adresa', { exact: true }).fill('test@example.invalid');
  await page.locator('input[name=password]').fill('Abcd1234');
  await page.getByRole('button', { name: 'Prijavi se', exact: false }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Prijava je uspjela, ali dodavanje u košaricu nije uspjelo.',
  );
  expect(fixture.addCount()).toBe(0);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('sb-127-auth-token')!).user.id),
  ).toBe(fixtureUser);
  reject = false;
  await page
    .getByRole('button', { name: 'Pokušaj ponovno dodati u košaricu', exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/kosarica$/);
  await expect(page.locator('.cart-total')).toContainText('350,00');
  expect(fixture.addCount()).toBe(1);
});

test('stvarno istekla prijava zadržava paket kroz ponovnu prijavu', async ({ page }) => {
  const fixture = await packageFixture(page);
  fixture.seed();
  let expired = true;
  await page.route('**/rest/v1/rpc/cart_add_variant', (route) =>
    expired
      ? route.fulfill({ status: 401, json: { code: 'PGRST301', message: 'JWT expired' } })
      : route.fallback(),
  );
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({ json: loginSession() }),
  );
  await page.goto(`/usluge/${fixture.service.slug}`);
  await page.getByRole('button', { name: 'Dodaj u košaricu', exact: true }).click();
  await expect(page).toHaveURL(/prijava\?.*package=b1900000-0000-4000-8000-000000000011/);
  expect(fixture.addCount()).toBe(0);
  expired = false;
  await page.getByLabel('E-mail adresa', { exact: true }).fill('test@example.invalid');
  await page.locator('input[name=password]').fill('Abcd1234');
  await page.getByRole('button', { name: 'Prijavi se', exact: false }).click();
  await expect(page).toHaveURL(/\/app\/kosarica$/);
  await expect(page.locator('.cart-total')).toContainText('350,00');
  expect(fixture.addCount()).toBe(1);
});

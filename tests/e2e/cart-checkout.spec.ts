import { test, expect, type Page } from '@playwright/test';
import { workspaceFixture, fixtureOrders } from '../fixtures/workspace';
async function details(page: Page) {
  await page.getByRole('button', { name: 'Nastavi na narudžbu' }).click();
  await page.getByLabel('Naslov / tema zadatka').fill('Uređivanje mojih dokumenata');
  await page.getByLabel('Predmet / područje').fill('Dokumenti');
  await page.getByLabel('Rok isporuke').fill('2035-12-20T14:00');
  await page.getByLabel('Ime i prezime mentora').fill('Test mentor');
  await page
    .getByLabel('Detaljne upute', { exact: true })
    .fill('Uredite oba dokumenta prema priloženim uputama.');
  await page.getByRole('button', { name: 'Nastavi na plaćanje' }).click();
}
test('dodavanje artikala puni košaricu i ne kreira narudžbu', async ({ page }, testInfo) => {
  await workspaceFixture(page, { stripe: true });
  const unexpected: string[] = [];
  page.on('request', (r) => {
    if (
      r.url().includes('/create_order') ||
      r.url().includes('/checkout_cart_order') ||
      r.url().includes('/functions/v1/checkout')
    )
      unexpected.push(r.url());
  });
  await page.goto('/app/nova-narudzba');
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Word dokumenti', exact: true }) })
    .getByRole('button', { name: 'Dodaj u košaricu' })
    .click();
  await page.getByRole('link', { name: 'Otvori košaricu' }).click();
  await expect(page.locator('.cart-total')).toContainText('50,02');
  await details(page);
  expect(unexpected).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Pregled prije plaćanja' })).toBeVisible();
  await expect(page.locator('.checkout-review')).toContainText('Uređivanje mojih dokumenata');
  await expect(page.getByRole('radio')).toHaveCount(6);
  await page.screenshot({
    path: `/tmp/formapoint-checkout-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await expect(page.getByRole('radio', { name: /Google Pay/ })).toBeDisabled();
  await expect(page.getByRole('radio', { name: /Apple Pay/ })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('IBAN 50/50 potvrđuje jednu narudžbu i prikazuje upute bez Stripe naplate', async ({
  page,
}) => {
  await workspaceFixture(page, { stripe: true });
  await page.route('**/rest/v1/rpc/checkout_options', (route) =>
    route.fulfill({ json: { card: true, bank: true, google_pay: true, apple_pay: true } }),
  );
  let payload: Record<string, unknown> | undefined;
  let stripeCalls = 0;
  page.on('request', (r) => {
    if (r.url().includes('/functions/v1/checkout')) stripeCalls++;
  });
  await page.route('**/rest/v1/rpc/checkout_cart_order', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: fixtureOrders[0].id });
  });
  await page.route('**/rest/v1/orders?*', (route) =>
    route.fulfill({
      json: [
        {
          ...fixtureOrders[0],
          status: 'deposit_pending',
          paid_cents: 0,
          payment_method: 'bank',
          bank_instructions: {
            recipient: 'Test primatelj',
            iban: 'HR1210010051863000160',
            bank: 'Test banka',
          },
          checkout_details: { course: 'Dokumenti', mentor: 'Test mentor' },
        },
      ],
    }),
  );
  await page.route('**/rest/v1/payment_installments?*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('order')).toContain('installment');
    return route.fulfill({
      json: [
        { id: 'i1', installment: 1, amount_cents: 1251 },
        { id: 'i2', installment: 2, amount_cents: 1250 },
      ],
    });
  });
  await page.goto('/app/kosarica');
  await details(page);
  await expect(page.getByRole('radio', { name: /Google Pay/ })).toBeEnabled();
  await page.getByRole('radio', { name: /Plaćanje u 2 rate/ }).check();
  await page.getByRole('radio', { name: /IBAN - 2 rate/ }).check();
  await page.getByRole('button', { name: 'Potvrdi narudžbu za IBAN uplatu' }).click();
  await expect(page).toHaveURL(new RegExp(`/app/narudzbe/${fixtureOrders[0].id}`));
  await expect(page.getByText('HR1210010051863000160', { exact: true })).toBeVisible();
  await expect(page.locator('.bank-instructions')).toContainText('12,51');
  await expect(page.getByRole('button', { name: 'Evidentiraj primljenu IBAN uplatu' })).toHaveCount(
    0,
  );
  expect(payload).toMatchObject({
    p_method: 'bank',
    p_model: 'split',
    p_title: 'Uređivanje mojih dokumenata',
    p_details: { course: 'Dokumenti', mentor: 'Test mentor' },
  });
  expect(typeof payload?.p_request).toBe('string');
  expect(stripeCalls).toBe(0);
});
test('administrator potvrđuje IBAN uplatu uz referencu bankovne transakcije', async ({ page }) => {
  await workspaceFixture(page, { admin: true, stripe: true });
  await page.route('**/rest/v1/orders?*', (route) =>
    route.fulfill({
      json: [
        {
          ...fixtureOrders[0],
          status: 'deposit_pending',
          paid_cents: 0,
          payment_method: 'bank',
          bank_instructions: {
            recipient: 'Test primatelj',
            iban: 'HR1210010051863000160',
            bank: 'Banka',
          },
        },
      ],
    }),
  );
  await page.route('**/rest/v1/payment_installments?*', (route) =>
    route.fulfill({ json: [{ id: 'i1', installment: 1, amount_cents: 1251 }] }),
  );
  let payload: unknown;
  await page.route('**/rest/v1/rpc/confirm_bank_payment', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: 'bank-payment-test' });
  });
  await page.goto(`/admin/narudzbe/${fixtureOrders[0].id}`);
  await page.getByRole('button', { name: 'Evidentiraj primljenu IBAN uplatu' }).click();
  await expect(page.getByLabel('Iznos primljen na račun (€)')).toHaveValue('12,51');
  await page
    .getByLabel('Jedinstvena referenca transakcije s bankovnog izvoda')
    .fill('BANK-TEST-001');
  await page.getByRole('button', { name: 'Potvrdi provjerenu uplatu' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(payload).toEqual({
    p_order: fixtureOrders[0].id,
    p_amount: 1251,
    p_reference: 'BANK-TEST-001',
  });
});

test('neuspjelo otvaranje Stripea čuva narudžbu i ponavlja samo naplatu', async ({ page }) => {
  await workspaceFixture(page, { stripe: true });
  let orders = 0,
    payments = 0;
  await page.route('**/rest/v1/rpc/checkout_cart_order', async (route) => {
    orders++;
    expect(route.request().postDataJSON()).toMatchObject({ p_method: 'card', p_model: 'split' });
    await route.fulfill({ json: fixtureOrders[0].id });
  });
  await page.route('**/rest/v1/orders?*', (route) =>
    route.fulfill({ json: [{ ...fixtureOrders[0], status: 'deposit_pending', paid_cents: 0 }] }),
  );
  await page.route('**/functions/v1/checkout', async (route) => {
    payments++;
    await route.fulfill({ status: 503, json: { error: 'Provider temporarily unavailable' } });
  });
  await page.goto('/app/kosarica');
  await details(page);
  await page.getByRole('radio', { name: /Plaćanje u 2 rate/ }).check();
  await page.getByRole('radio', { name: /Kartica - 2 rate/ }).check();
  await page.getByRole('button', { name: 'Potvrdi i nastavi na sigurnu naplatu' }).click();
  await expect(
    page.getByText(
      'Narudžba je spremljena. Naplata nije otvorena; pokušajte ponovno u detaljima narudžbe.',
    ),
  ).toBeVisible();
  expect(orders).toBe(1);
  expect(payments).toBe(1);
  await page.getByRole('button', { name: 'Plati putem Stripea' }).click();
  await expect.poll(() => payments).toBe(2);
  expect(orders).toBe(1);
});

test('postavke odvojeno spremaju IBAN i uključuju bankovno plaćanje', async ({ page }) => {
  await workspaceFixture(page, { admin: true, stripe: true });
  await page.goto('/admin/postavke');
  await page.getByRole('button', { name: 'Uplate i pravila' }).click();
  await page.getByLabel('Primatelj (naziv tvrtke ili obrta)').fill('Test primatelj');
  await page.getByLabel('IBAN', { exact: true }).fill('HR1210010051863000160');
  const bankWrite = page.waitForRequest(
    (r) => r.method() === 'PATCH' && r.url().includes('/business_settings'),
  );
  await page.getByRole('button', { name: 'Spremi podatke za uplatu' }).click();
  expect((await bankWrite).postDataJSON()).toMatchObject({
    iban: 'HR1210010051863000160',
    payment_recipient: 'Test primatelj',
  });
  await page.getByLabel('Omogući IBAN plaćanje (jednokratno i 50/50)').check();
  const settingWrite = page.waitForRequest(
    (r) => r.method() === 'PATCH' && r.url().includes('/site_settings'),
  );
  await page.getByRole('button', { name: 'Spremi plaćanje i pravila' }).click();
  expect((await settingWrite).postDataJSON()).toMatchObject({
    bank_enabled: true,
    stripe_enabled: true,
    maintenance: false,
  });
});

test('nedostajuća checkout nadogradnja nudi SQL 010 prije uključivanja IBAN-a', async ({
  page,
}) => {
  await workspaceFixture(page, { admin: true, stripe: true });
  await page.route('**/rest/v1/rpc/checkout_options', (route) =>
    route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Missing function' } }),
  );
  await page.goto('/admin/postavke');
  await page.getByRole('button', { name: 'Uplate i pravila' }).click();
  await expect(
    page.getByRole('link', { name: 'SQL nadogradnju 010', exact: true }),
  ).toHaveAttribute('href', '/migracije/202610250010_cart_checkout.sql');
  await expect(page.getByLabel('Omogući IBAN plaćanje (jednokratno i 50/50)')).toBeDisabled();
});

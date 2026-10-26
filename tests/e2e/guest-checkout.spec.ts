import { test, expect } from '@playwright/test';
import { workspaceFixture, fixtureUser } from '../fixtures/workspace';
function session(anonymous: boolean) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: fixtureUser, role: 'authenticated', exp })}.fixture`,
    refresh_token: 'fixture-refresh',
    expires_in: 3600,
    expires_at: exp,
    token_type: 'bearer',
    user: {
      id: fixtureUser,
      aud: 'authenticated',
      role: 'authenticated',
      is_anonymous: anonymous,
      email: anonymous ? '' : 'ana@example.invalid',
      app_metadata: { provider: anonymous ? 'anonymous' : 'email' },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}
test('kupnja bez prijave stvara gostujuću sesiju i sprema kontakt', async ({ page }) => {
  await workspaceFixture(page, { signedIn: false, stripe: true });
  let signed = false;
  let contact: Record<string, unknown> = {};
  await page.route('**/auth/v1/signup', async (route) => {
    expect(route.request().postDataJSON().password).toBeUndefined();
    expect(route.request().postDataJSON().email).toBeUndefined();
    signed = true;
    await route.fulfill({ json: session(true) });
  });
  await page.route('**/rest/v1/rpc/save_guest_contact', async (route) => {
    expect(signed).toBe(true);
    contact = route.request().postDataJSON();
    await route.fulfill({ json: null });
  });
  await page.goto('/app/kosarica');
  await expect(page.getByRole('heading', { name: 'Kupnja kao gost' })).toBeVisible();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.getByLabel('Ime', { exact: true }).fill('Ana');
  await page.getByLabel('Prezime', { exact: true }).fill('Gost');
  await page.getByLabel('E-mail', { exact: true }).fill('ana@example.invalid');
  await page.locator('input[name=terms]').check();
  await page.getByRole('button', { name: 'Nastavi kao gost' }).click();
  await expect(page).toHaveURL(/\/app\/kosarica$/);
  await expect(page.locator('.cart-total')).toBeVisible();
  expect(contact).toEqual({
    p_first: 'Ana',
    p_last: 'Gost',
    p_email: 'ana@example.invalid',
    p_terms: true,
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Košarica', exact: true })).toBeVisible();
});
test('registracija prihvaća 8 znakova i odmah otvara aplikaciju bez potvrde e-maila', async ({
  page,
}) => {
  await workspaceFixture(page, { signedIn: false });
  let submissions = 0;
  await page.route('**/auth/v1/signup', async (route) => {
    expect(route.request().postDataJSON().password).toBe('Abcd1234');
    submissions++;
    await route.fulfill({ json: session(false) });
  });
  await page.goto('/registracija');
  await page.getByLabel('Ime', { exact: true }).fill('Ana');
  await page.getByLabel('Prezime', { exact: true }).fill('Gost');
  await page.getByLabel('E-mail adresa', { exact: true }).fill('ana@example.invalid');
  await page.locator('input[name=password]').fill('Abcd123');
  await page.getByLabel('Potvrda lozinke', { exact: true }).fill('Abcd123');
  await page.locator('input[name=terms]').check();
  await page.getByRole('button', { name: 'Kreiraj račun' }).click();
  await expect(
    page.getByText('Unesite lozinku; nova lozinka treba imati najmanje 8 znakova.'),
  ).toBeVisible();
  expect(submissions).toBe(0);
  await page.locator('input[name=password]').fill('Abcd1234');
  await page.getByLabel('Potvrda lozinke', { exact: true }).fill('Abcd1234');
  await page.getByRole('button', { name: 'Kreiraj račun' }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(submissions).toBe(1);
});
test('gost dodaje podatke za račun uz zadržavanje svojeg identifikatora', async ({ page }) => {
  await workspaceFixture(page, { signedIn: false });
  const guest = session(true);
  await page.addInitScript(
    (value) => localStorage.setItem('sb-127-auth-token', JSON.stringify(value)),
    guest,
  );
  let updated = false;
  await page.route('**/auth/v1/user', async (route) => {
    if (route.request().method() === 'PUT') {
      expect(route.request().postDataJSON()).toMatchObject({
        email: 'ana@example.invalid',
        password: 'Abcd1234',
      });
      updated = true;
    }
    await route.fulfill({ json: { user: session(false).user } });
  });
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    expect(updated).toBe(true);
    await route.fulfill({ json: session(false) });
  });
  await page.route('**/auth/v1/signup', () => {
    throw new Error('Gost ne smije dobiti drugi račun i izgubiti narudžbe');
  });
  await page.goto('/registracija');
  await page.getByLabel('Ime', { exact: true }).fill('Ana');
  await page.getByLabel('Prezime', { exact: true }).fill('Gost');
  await page.getByLabel('E-mail adresa', { exact: true }).fill('ana@example.invalid');
  await page.locator('input[name=password]').fill('Abcd1234');
  await page.getByLabel('Potvrda lozinke', { exact: true }).fill('Abcd1234');
  await page.locator('input[name=terms]').check();
  await page.getByRole('button', { name: 'Kreiraj račun' }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(updated).toBe(true);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('sb-127-auth-token')!).user.id),
  ).toBe(fixtureUser);
});

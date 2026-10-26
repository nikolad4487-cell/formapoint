import { test, expect } from '@playwright/test';
import { workspaceFixture } from '../fixtures/workspace';
test('administracija prikazuje API podatke i zajednički dizajn-sustav', async ({ page }) => {
  await workspaceFixture(page, { admin: true });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Administracija');
  await expect(page.locator('.admin-stats .stat-card')).toHaveCount(5);
  await expect(page.locator('.skeleton')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/admin/dizajn-sustav');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dizajn-sustav');
  await page.getByRole('button', { name: 'Primarni gumb' }).click();
  await expect(page.getByRole('status')).toContainText('1');
  await page.getByLabel('E-mail za provjeru formata').fill('pogresno');
  await expect(page.getByText('Unesite ispravnu e-mail adresu.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('korisnik ne može otvoriti administratorski prikaz', async ({ page }) => {
  await workspaceFixture(page);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nadzorna ploča');
});
test('prazni privatni prikazi nemaju izmišljene narudžbe i iznose', async ({ page }) => {
  await workspaceFixture(page, { empty: true });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Započnite prvi projekt' })).toBeVisible();
  await expect(page.locator('.stat-card').first()).toContainText('0');
  await page.goto('/app/placanja');
  await expect(page.getByRole('heading', { name: 'Nema transakcija' })).toBeVisible();
  await expect(page.locator('.stat-card').first()).toContainText('0,00');
});
test('pogreška API-ja daje mogućnost ponovnog pokušaja', async ({ page }) => {
  await workspaceFixture(page, { fail: true });
  await page.goto('/app/narudzbe');
  await expect(page.getByRole('heading', { name: 'Podatke nije moguće učitati' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pokušaj ponovno' })).toBeVisible();
});

test('povratak na karticu i obnova iste sesije čuvaju otvoren obrazac artikla', async ({
  page,
}) => {
  await workspaceFixture(page, { admin: true });
  await page.clock.install();
  let roleReads = 0;
  let serviceReads = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/rest/v1/services') serviceReads++;
  });
  await page.route('**/rest/v1/user_roles?*', async (route) => {
    roleReads++;
    if (roleReads > 1) await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: [{ role: 'ADMIN' }] });
  });
  await page.goto('/admin/usluge');
  await page.getByRole('button', { name: 'Usluga', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nova usluga' });
  await dialog.getByLabel('Naziv', { exact: true }).fill('Nedovršeni novi artikl');
  await dialog.getByLabel('Slug', { exact: true }).fill('nedovrseni-artikl');
  await dialog
    .getByLabel('Opis', { exact: true })
    .fill('Ovaj opis mora ostati nakon povratka na karticu.');
  const initialRoles = roleReads,
    initialServices = serviceReads;
  // Make data stale, then fire the visibility/focus events used by both
  // Supabase session recovery and TanStack Query's window focus manager.
  await page.clock.fastForward(16000);
  await page.evaluate(async () => {
    let visibility = 'hidden';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    const path = '/src/lib/supabase.ts';
    const { db } = await import(path);
    const { data } = await db.auth.getSession();
    const result = await db.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (result.error) throw result.error;
  });
  // Allow focus listeners/background requests to settle before negative checks.
  await page.waitForTimeout(500);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Naziv', { exact: true })).toHaveValue('Nedovršeni novi artikl');
  await expect(dialog.getByLabel('Opis', { exact: true })).toHaveValue(
    'Ovaj opis mora ostati nakon povratka na karticu.',
  );
  expect(roleReads).toBe(initialRoles);
  expect(serviceReads).toBe(initialServices);
  await page.route('**/auth/v1/token?grant_type=refresh_token', async (route) => {
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('sb-127-auth-token')!),
    );
    await route.fulfill({ json: { ...stored, expires_in: 3600 } });
  });
  await page.evaluate(async () => {
    const path = '/src/lib/supabase.ts';
    const { db } = await import(path);
    const result = await db.auth.refreshSession();
    if (result.error) throw result.error;
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Slug', { exact: true })).toHaveValue('nedovrseni-artikl');
  expect(roleReads).toBe(initialRoles);
  // A real sign-out must still discard private UI and revoke client access.
  await page.evaluate(async () => {
    const path = '/src/lib/supabase.ts';
    const { db } = await import(path);
    const result = await db.auth.signOut();
    if (result.error) throw result.error;
  });
  await expect(page).toHaveURL(/\/prijava$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('ponovljeni događaj prijave ne prekida početnu provjeru administratorskih ovlasti', async ({
  page,
}) => {
  await workspaceFixture(page, { admin: true });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let roleReads = 0;
  await page.route('**/rest/v1/user_roles?*', async (route) => {
    roleReads++;
    await gate;
    await route.fulfill({ json: [{ role: 'ADMIN' }] });
  });
  await page.goto('/admin/usluge');
  await expect.poll(() => roleReads).toBeGreaterThan(0);
  await page.evaluate(async () => {
    const path = '/src/lib/supabase.ts';
    const { db } = await import(path);
    const { data } = await db.auth.getSession();
    const result = await db.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (result.error) throw result.error;
  });
  release();
  await expect(page.getByRole('heading', { name: 'Upravljanje katalogom' })).toBeVisible();
});

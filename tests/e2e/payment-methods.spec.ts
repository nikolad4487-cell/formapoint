import { test, expect } from '@playwright/test';
import { workspaceFixture } from '../fixtures/workspace';
test.beforeEach(async ({ page }) => workspaceFixture(page, { admin: true, stripe: true }));
test('novčanik se dodaje skriven i prikazuje tek nakon potvrde Stripe postavki', async ({
  page,
}) => {
  const siteWrites: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/site_settings')) siteWrites.push(r.url());
  });
  await page.goto('/admin/postavke');
  await page.getByRole('button', { name: 'Uplate i pravila' }).click();
  await expect(page.locator('.managed-payment-method')).toHaveCount(2);
  await expect(page.getByLabel('Učitaj ikonu KEKS Pay')).toHaveCount(0);
  await expect(page.getByLabel('Učitaj ikonu Google Pay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dodaj način plaćanja', exact: true }).click();
  await page.getByRole('combobox', { name: 'Metoda', exact: true }).selectOption('google_pay');
  await page.getByRole('button', { name: 'Dodaj metodu', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/app/placanja');
  await expect(page.locator('.payment-methods')).not.toContainText('Google Pay');
  await page.goto('/admin/postavke');
  await page.getByRole('button', { name: 'Uplate i pravila' }).click();
  const method = page
    .locator('.managed-payment-method')
    .filter({ has: page.locator('strong', { hasText: 'Google Pay' }) });
  await method.getByRole('button', { name: 'Prikaži kupcima' }).click();
  const confirm = page.getByRole('button', { name: 'Potvrdi prikaz', exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByRole('dialog').getByRole('checkbox').check();
  await confirm.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/app/placanja');
  await expect(page.locator('.payment-methods')).toContainText('Google Pay');
  await expect(page.locator('.payment-methods')).toContainText(
    'kada ih podržavaju vaš uređaj i kartica',
  );
  expect(siteWrites).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('uklanjanje metode mijenja javni popis, a nepovezani pružatelj ostaje u pripremi', async ({
  page,
}) => {
  await page.goto('/admin/postavke');
  await page.getByRole('button', { name: 'Uplate i pravila' }).click();
  await page.getByRole('button', { name: 'Ukloni način plaćanja Mastercard', exact: true }).click();
  await page.getByRole('button', { name: 'Potvrdi uklanjanje' }).click();
  await expect(page.locator('.managed-payment-method')).toHaveCount(1);
  await page.getByRole('button', { name: 'Dodaj način plaćanja', exact: true }).click();
  await page.getByRole('combobox', { name: 'Metoda', exact: true }).selectOption('custom');
  await page.getByLabel('Naziv metode').fill('KEKS Pay');
  await page.getByRole('button', { name: 'Dodaj metodu', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const method = page
    .locator('.managed-payment-method')
    .filter({ has: page.locator('strong', { hasText: 'KEKS Pay' }) });
  await expect(method).toContainText('Nije povezana s naplatom');
  await expect(method.getByRole('button', { name: 'Prikaži kupcima' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/app/placanja');
  await expect(page.locator('.payment-methods')).toContainText('Visa');
  await expect(page.locator('.payment-methods')).not.toContainText('Mastercard');
  await expect(page.locator('.payment-methods')).not.toContainText('KEKS Pay');
});
test('nenadograđena baza nudi točnu SQL datoteku za metode plaćanja', async ({ page }) => {
  await page.route('**/rest/v1/payment_methods*', (r) =>
    r.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'PGRST205', message: 'Missing schema' }),
    }),
  );
  await page.goto('/admin/postavke');
  await page.getByRole('button', { name: 'Uplate i pravila' }).click();
  await expect(page.getByText('Potrebna je nadogradnja načina plaćanja')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Preuzmi SQL nadogradnju 008' })).toHaveAttribute(
    'href',
    '/migracije/202610240008_payment_methods.sql',
  );
});

import { test, expect } from '@playwright/test';
import { workspaceFixture } from '../fixtures/workspace';
test.beforeEach(async ({ page }) => {
  await workspaceFixture(page);
});
test('dashboard, pretraživanje i otvaranje stvarnog prikaza narudžbe', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nadzorna ploča');
  await expect(page.locator('.stat-card').first()).toContainText('2');
  await page.getByRole('searchbox', { name: 'Pretraži narudžbe' }).fill('prezentacija');
  await page.getByRole('searchbox', { name: 'Pretraži narudžbe' }).press('Enter');
  await expect(page).toHaveURL(/q=prezentacija/);
  await expect(page.locator('.order-register-row')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Pretraži narudžbe' }).fill('dokument');
  await page.getByRole('searchbox', { name: 'Pretraži narudžbe' }).press('Enter');
  await expect(page.locator('.order-register-row')).toContainText('Testni dokument');
  await page.getByRole('searchbox', { name: 'Pretraži narudžbe' }).fill('prezentacija');
  await page.getByRole('searchbox', { name: 'Pretraži narudžbe' }).press('Enter');
  await expect(page.locator('.order-register-row')).toContainText('Testna prezentacija');
  await page.locator('.order-register-row>summary').click();
  await expect(page.getByRole('heading', { name: 'Detalji narudžbe' })).toBeVisible();
  await expect(
    page.getByText('Isključivo testni opis narudžbe za browser provjere.'),
  ).toBeVisible();
  await page.getByRole('searchbox', { name: 'Pretraži narudžbe' }).fill('');
  await page.getByRole('searchbox', { name: 'Pretraži narudžbe' }).press('Enter');
  await expect(page.locator('.order-register-row')).toHaveCount(2);
  await page.getByRole('button', { name: /^Čeka uplatu/ }).click();
  await expect(page.locator('.order-register-row')).toHaveCount(1);
  await expect(page.locator('.order-register-row')).toContainText('Testni dokument');
});
test('košarica mijenja količinu preko API-ja i uklanja stavku', async ({ page }) => {
  await page.goto('/app/kosarica');
  await expect(page.locator('.cart-total')).toContainText('25,01');
  await page.getByRole('button', { name: 'Povećaj količinu: Word dokumenti' }).click();
  await expect(page.locator('.cart-total')).toContainText('50,02');
  await page.getByRole('button', { name: 'Ukloni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Košarica je prazna' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nastavi na narudžbu' })).toHaveCount(0);
});
test('plaćanja koriste API podatke i ne prikazuju neaktivne metode kao aktivne', async ({
  page,
}) => {
  await page.goto('/app/placanja');
  await expect(page.locator('.stat-card').first()).toContainText('12,51');
  await expect(page.getByText('Online plaćanje trenutačno nije aktivirano.')).toBeVisible();
  await expect(page.getByText('PayPal', { exact: true })).toHaveCount(0);
  await expect(page.getByText('CorvusPay', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Plati sada' })).toHaveCount(0);
});
test('privatne stranice ne prelijevaju zaslon i ne bacaju JS pogreške', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of ['/app', '/app/narudzbe', '/app/kosarica', '/app/placanja']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.skeleton')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      route,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('mobilni drawer zatvara Escape i vraća fokus', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Samo mobilni izbornik');
  await page.goto('/app');
  const toggle = page.getByRole('button', { name: 'Otvori navigaciju' });
  await toggle.click();
  await expect(page.getByRole('dialog', { name: 'Navigacija radnog prostora' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Korisnička navigacija' })).not.toBeVisible();
});

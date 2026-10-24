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

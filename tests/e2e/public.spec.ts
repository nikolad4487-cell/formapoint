import { test, expect } from '@playwright/test';
test('početna stranica i katalog bez konfiguracije', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Digitalne usluge');
  await page.getByRole('link', { name: 'Pogledaj usluge' }).click();
  await expect(page).toHaveURL(/\/usluge$/);
  await page.getByPlaceholder('Pretražite usluge…').fill('Excel');
  await expect(page.locator('.service-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Saznaj više: Excel tablice' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel tablice');
  expect(errors).toEqual([]);
});
test('nedostupna prijava nema lažni uspjeh', async ({ page }) => {
  await page.goto('/registracija');
  await expect(page.getByText('Supabase nije konfiguriran.', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Usluga trenutačno nije dostupna')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kreiraj račun' })).toBeDisabled();
  await page.goto('/app');
  await expect(page.getByText('Usluga trenutačno nije dostupna')).toBeVisible();
});
test('FAQ se može otvoriti tipkovnicom', async ({ page }) => {
  await page.goto('/faq');
  const summary = page.locator('summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Odaberite uslugu, opišite zadatak', { exact: false })).toBeVisible();
});
test('sve javne stranice imaju naslov i ne prelijevaju zaslon', async ({ page }) => {
  test.setTimeout(60000);
  for (const path of [
    '/',
    '/usluge',
    '/usluge/word-dokumenti',
    '/cjenik',
    '/kako-funkcionira',
    '/o-nama',
    '/kontakt',
    '/faq',
    '/prijava',
    '/registracija',
    '/zaboravljena-lozinka',
    '/reset-lozinke',
    '/potvrda-emaila',
    '/uvjeti-koristenja',
    '/pravila-privatnosti',
    '/kolacici',
    '/otkazivanje-i-povrati',
    '/prigovori',
    '/portfolio',
    '/odjava-newslettera',
    '/nepostojeca',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      path,
    ).toBe(true);
  }
});
test('navigacija na mobitelu radi', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobilna navigacija');
  await page.goto('/');
  await page.getByRole('button', { name: 'Otvori izbornik' }).click();
  await page
    .getByRole('navigation', { name: 'Glavna navigacija' })
    .getByRole('link', { name: 'Kontakt', exact: true })
    .click();
  await expect(page).toHaveURL(/\/kontakt$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Razgovarajmo');
});

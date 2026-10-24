import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { workspaceFixture } from '../fixtures/workspace';
test.beforeEach(async ({ page }) => workspaceFixture(page, { admin: true }));
test('postavke spremaju i prazni kontakt bez prepisivanja ostalih odjeljaka', async ({ page }) => {
  await page.goto('/admin/postavke');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Postavke aplikacije');
  await page.getByLabel('Javni kontakt e-mail').fill('');
  const request = page.waitForRequest(
    (r) => r.method() === 'PATCH' && r.url().includes('/site_settings'),
  );
  await page.getByRole('button', { name: 'Spremi opće postavke' }).click();
  expect((await request).postDataJSON()).toMatchObject({
    public_contact_email: '',
    platform_name: 'FormaPoint',
    maintenance: true,
  });
  await page.getByRole('button', { name: 'Osobni podaci' }).click();
  await expect(page.getByLabel('Ime', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});
test('CMS nacrt i zasebna potvrda pravne objave', async ({ page }) => {
  await page.goto('/admin/stranice');
  await page.getByRole('button', { name: 'Nova stranica' }).click();
  await page.getByLabel('Naslov', { exact: true }).fill('Uvjeti testiranja');
  await page.getByLabel('Slug', { exact: true }).fill('uvjeti-koristenja');
  await page
    .getByLabel('Sadržaj', { exact: true })
    .fill('Ovo je provjereni pravni sadržaj za browser test.');
  await page.getByRole('button', { name: 'Spremi nacrt' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Nacrt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Objavi', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Objavi stranicu' });
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox').check();
  await confirm.click();
  await expect(page.getByText('Objavljeno', { exact: true })).toBeVisible();
  await page.goto('/p/uvjeti-koristenja');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Uvjeti testiranja');
  await expect(page.getByText('Ovo je provjereni pravni sadržaj za browser test.')).toBeVisible();
});
test('portfolio traži prava i prikazuje spremljeni primjer javno', async ({ page }) => {
  await page.goto('/admin/portfolio');
  await page.getByRole('button', { name: 'Dodaj novi rad' }).click();
  await page.getByLabel('Naziv rada').fill('Primjer oblikovanja');
  await page.getByLabel('Opis', { exact: true }).fill('Primjer pravilno oblikovanog dokumenta.');
  await page.getByLabel('Javna PDF poveznica').fill('https://example.invalid/primjer.pdf');
  await page.getByRole('button', { name: 'Spremi rad', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Objavi', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Uredi', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Spremi rad', exact: true }).click();
  await page.getByRole('button', { name: 'Objavi', exact: true }).click();
  await page.goto('/portfolio');
  await expect(page.getByRole('heading', { name: 'Primjer oblikovanja' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pogledaj PDF' })).toHaveAttribute(
    'href',
    'https://example.invalid/primjer.pdf',
  );
});
test('newsletter sprema HTML i ostaje bez slanja dok integracija nije konfigurirana', async ({
  page,
}) => {
  await page.goto('/admin/newsletter');
  await page.getByRole('button', { name: 'Novi predložak' }).click();
  await page.getByLabel('Naziv predloška').fill('Ponuda za mjesec');
  await page.getByLabel('Predmet poruke').fill('Nova FormaPoint ponuda');
  await page
    .getByLabel('HTML poruke')
    .fill('<h1>Posebna ponuda</h1><script>parent.location="https://example.invalid"</script>');
  const frame = page.locator('iframe');
  await expect(frame).toHaveAttribute('sandbox', '');
  await expect(frame).toHaveAttribute('srcdoc', /default-src 'none'/);
  await page.getByRole('button', { name: 'Spremi predložak' }).click();
  await expect(page.getByRole('heading', { name: 'Ponuda za mjesec' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pošalji', exact: true })).toBeDisabled();
});
test('izvoz logotipa stvara stvarni PNG', async ({ page }) => {
  await page.goto('/admin/vizualni-identitet');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Preuzmi PNG' }).first().click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe('formapoint-profil.png');
  const data = await readFile((await file.path())!);
  expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
test('novi admin moduli rade na uskom zaslonu bez JS pogrešaka', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of [
    '/admin/usluge',
    '/admin/korisnici',
    '/admin/kuponi',
    '/admin/postavke',
    '/admin/stranice',
    '/admin/portfolio',
    '/admin/newsletter',
    '/admin/vizualni-identitet',
  ]) {
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
test('nedostajuća migracija nudi SQL datoteku umjesto praznog modula', async ({ page }) => {
  await page.route('**/rest/v1/content_pages*', (r) =>
    r.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'PGRST205', message: 'Schema cache missing' }),
    }),
  );
  await page.goto('/admin/stranice');
  await expect(page.getByText('Potrebna je nadogradnja baze', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Preuzmi SQL nadogradnju' })).toHaveAttribute(
    'href',
    '/migracije/202610240006_admin_tools.sql',
  );
});
test('ikona kartice se učitava kao PNG i može ukloniti bez unosa poveznice', async ({ page }) => {
  await page.goto('/admin/postavke');
  await page.getByRole('button', { name: 'Uplate i pravila' }).click();
  await expect(page.getByLabel('Učitaj ikonu Visa', { exact: true })).toBeVisible();
  const sourceImage = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#3155f6';
    ctx.fillRect(0, 0, 4, 4);
    return c.toDataURL('image/jpeg').split(',')[1];
  });
  const upload = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/storage/v1/object/payment-icons/visa/'),
  );
  await page
    .getByLabel('Učitaj ikonu Visa', { exact: true })
    .setInputFiles({
      name: 'visa.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(sourceImage, 'base64'),
    });
  const uploadedRequest = await upload;
  const multipart = await new Response(uploadedRequest.postDataBuffer(), {
    headers: { 'Content-Type': uploadedRequest.headers()['content-type'] },
  }).formData();
  const image = [...multipart.values()].find((value) => typeof value !== 'string') as File;
  expect(image.type).toBe('image/png');
  const bytes = new Uint8Array(await image.arrayBuffer());
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  await expect(page.getByRole('img', { name: 'Ikona Visa', exact: true })).toBeVisible();
  await expect(page.locator('input[name="icon_visa"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Ukloni ikonu Visa', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Ikona Visa', exact: true })).toHaveCount(0);
});
test('novi popust sprema uvjet da kupac nema prethodnih narudžbi', async ({ page }) => {
  await page.goto('/admin/kuponi');
  await page.getByRole('button', { name: 'Novi popust' }).click();
  await page.getByLabel('Naziv predloška').fill('Dobrodošlica');
  await page.getByLabel('Kod', { exact: true }).fill('PRVI20');
  await page.getByLabel('Vrijednost', { exact: true }).fill('20');
  await page.getByLabel('Najviše korištenja').fill('100');
  await page.getByLabel('Vrijedi do').fill('2027-12-31T23:59');
  await page.getByLabel('Kome vrijedi popust?').selectOption('new');
  const saved = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/rest/v1/promo_codes'),
  );
  await page.getByRole('button', { name: 'Izradi popust' }).click();
  expect((await saved).postDataJSON()).toMatchObject({
    first_order_only: true,
    customer_id: null,
    code: 'PRVI20',
  });
  await expect(
    page.getByText('Samo novi korisnici — prva narudžba', { exact: true }),
  ).toBeVisible();
  const changed = page.waitForRequest(
    (r) => r.method() === 'PATCH' && r.url().includes('/rest/v1/promo_codes'),
  );
  await page.getByRole('checkbox', { name: 'Samo novi korisnici za kupon PRVI20' }).uncheck();
  expect((await changed).postDataJSON()).toMatchObject({ first_order_only: false });
  await expect(page.getByText('Za sve korisnike', { exact: true })).toBeVisible();
});

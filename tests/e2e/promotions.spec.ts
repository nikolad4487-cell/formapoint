import { test, expect } from '@playwright/test';
import { workspaceFixture, fixtureUser } from '../fixtures/workspace';
test('prigodna promocija personalizira pregled i šalje odabranom korisniku s automatskim rokom', async ({
  page,
}, testInfo) => {
  await workspaceFixture(page, { admin: true });
  let created = false;
  let body: any;
  await page.route('**/rest/v1/rpc/personal_promotion_summary', (route) =>
    route.fulfill({
      json: created
        ? [
            {
              id: 'd8000000-0000-4000-8000-000000000001',
              name: 'Uskrsni poklon',
              occasion: 'easter',
              recipients: 1,
              sent: 1,
              pending: 0,
              failed: 0,
              skipped: 0,
              starts_at: '2026-10-26T12:00:00Z',
              expires_at: '2026-11-25T12:00:00Z',
            },
          ]
        : [],
    }),
  );
  await page.route('**/functions/v1/promotions', async (route) => {
    const value = route.request().postDataJSON();
    if (value.action === 'health')
      return route.fulfill({
        json: { schema_ready: true, email_configured: true, worker_ready: true },
      });
    if (value.action === 'create') {
      created = true;
      body = value;
      return route.fulfill({
        json: {
          campaign_id: 'd8000000-0000-4000-8000-000000000001',
          claimed: 1,
          sent: 1,
          failed: 0,
          skipped: 0,
          available: true,
        },
      });
    }
    return route.fulfill({ json: { claimed: 0, sent: 0, available: true } });
  });
  await page.goto('/admin/kuponi');
  await page.getByRole('button', { name: 'Nova promocija', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova personalizirana promocija' });
  await dialog.getByLabel('Naziv promocije', { exact: true }).fill('Uskrsni poklon');
  await dialog.getByRole('combobox', { name: 'Prigoda', exact: true }).selectOption('easter');
  await expect(dialog.getByLabel('Naslov e-maila')).toHaveValue(
    '{ime}, uskrsni poklon od FormaPointa',
  );
  await expect(dialog.locator('img')).toHaveAttribute('src', '/promotions/easter.jpg');
  await dialog.getByLabel('Vrijednost (%)').fill('15');
  await dialog.getByRole('combobox', { name: 'Primatelji', exact: true }).selectOption('selected');
  await dialog.getByRole('checkbox').first().check();
  await dialog
    .getByLabel('Personalizirana poruka')
    .fill('Pozdrav {ime}, tvoj uskrsni poklon je {popust}. Iskoristi {kod} do {do}.');
  await dialog.locator('summary').click();
  const preview = dialog.frameLocator('iframe[title="Pregled promotivnog e-maila"]');
  await expect(preview.getByText('USKRS-PRIMJER', { exact: true })).toBeVisible();
  await expect(preview.locator('body')).toContainText('15 %');
  await page.screenshot({ path: `/tmp/formapoint-promotions-${testInfo.project.name}.png` });
  await dialog.getByRole('button', { name: 'Izradi kodove i pošalji e-mail', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(body).toMatchObject({
    occasion: 'easter',
    value: 15,
    kind: 'percent',
    user_ids: [fixtureUser],
    starts_at: null,
    expires_at: null,
    image_url: null,
  });
  expect(body.request_id).toMatch(/^[a-f0-9-]{36}$/);
  await expect(
    page.getByText('1 kodova · 1 poslano · 0 čeka · 0 neuspjelo · 0 preskočeno'),
  ).toBeVisible();
});
test('neuspješno kreiranje čuva podatke i isti identifikator zahtjeva za siguran ponovni pokušaj', async ({
  page,
}) => {
  await workspaceFixture(page, { admin: true });
  const requests: any[] = [];
  await page.route('**/rest/v1/rpc/personal_promotion_summary', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/functions/v1/promotions', (route) => {
    const value = route.request().postDataJSON();
    if (value.action === 'health')
      return route.fulfill({
        json: { schema_ready: true, email_configured: true, worker_ready: true },
      });
    requests.push(value);
    return route.fulfill({
      status: 503,
      json: { error: 'Slanje trenutačno nije dostupno. Pokušajte ponovno.' },
    });
  });
  await page.goto('/admin/kuponi');
  await page.getByRole('button', { name: 'Nova promocija', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova personalizirana promocija' });
  await dialog.getByLabel('Naziv promocije', { exact: true }).fill('Božićni poklon');
  await dialog.getByRole('button', { name: 'Izradi kodove i pošalji e-mail', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Slanje trenutačno nije dostupno.');
  await expect(dialog.getByLabel('Naziv promocije', { exact: true })).toHaveValue('Božićni poklon');
  await dialog.getByRole('button', { name: 'Izradi kodove i pošalji e-mail', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[0].request_id).toBe(requests[1].request_id);
});

test.describe('Zakazivanje prema vremenu Hrvatske', () => {
  test.use({ timezoneId: 'America/New_York' });
  test('budući početak zakazuje slanje i čuva automatski završetak od 30 dana', async ({
    page,
  }) => {
    await workspaceFixture(page, { admin: true });
    let created = false;
    let captured: any;
    await page.route('**/rest/v1/rpc/personal_promotion_summary', (route) =>
      route.fulfill({
        json: created
          ? [
              {
                id: 'd8000000-0000-4000-8000-000000000015',
                name: 'Zakazani Božić',
                occasion: 'christmas',
                recipients: 1,
                sent: 0,
                pending: 1,
                failed: 0,
                skipped: 0,
                starts_at: '2030-11-30T23:00:00Z',
                expires_at: '2030-12-30T23:00:00Z',
              },
            ]
          : [],
      }),
    );
    await page.route('**/functions/v1/promotions', async (route) => {
      const body = route.request().postDataJSON();
      if (body.action === 'health')
        return route.fulfill({
          json: {
            schema_ready: true,
            email_configured: true,
            worker_ready: true,
            scheduled_sending_ready: true,
          },
        });
      if (body.action === 'create') {
        created = true;
        captured = body;
        return route.fulfill({
          json: {
            campaign_id: 'd8000000-0000-4000-8000-000000000015',
            claimed: 0,
            sent: 0,
            failed: 0,
            skipped: 0,
            available: true,
          },
        });
      }
      return route.fulfill({ json: { claimed: 0, sent: 0, available: true } });
    });
    await page.goto('/admin/kuponi');
    await page.getByRole('button', { name: 'Nova promocija', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nova personalizirana promocija' });
    await dialog.getByLabel('Naziv promocije', { exact: true }).fill('Zakazani Božić');
    await dialog.getByLabel(/Vrijedi od \/ slanje/).fill('2030-12-01T00:00');
    await expect(dialog.getByLabel(/Vrijedi do/)).toHaveValue('');
    await dialog
      .getByRole('button', { name: 'Izradi kodove i zakaži slanje', exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(captured.starts_at).toBe('2030-11-30T23:00:00.000Z');
    expect(captured.expires_at).toBeNull();
    await expect(
      page.getByText('Osobni kodovi su kreirani. E-mailovi su zakazani za početak valjanosti.'),
    ).toBeVisible();
    await expect(
      page.getByText('1 kodova · 0 poslano · 1 čeka · 0 neuspjelo · 0 preskočeno'),
    ).toBeVisible();
  });
});

test('rođendani imaju godišnje pravilo bez zajedničkih datuma i odabira primatelja', async ({
  page,
}) => {
  await workspaceFixture(page, { admin: true });
  let saved: any;
  await page.route('**/rest/v1/rpc/personal_promotion_summary', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/rest/v1/birthday_promotion_settings**', (route) =>
    route.fulfill({
      json: saved
        ? {
            name: saved.name,
            kind: saved.kind,
            value: saved.value,
            validity_days: saved.validity_days,
            subject: saved.subject,
            message: saved.message,
            image_url: 'https://example.invalid/birthday.jpg',
            active: saved.active,
          }
        : null,
    }),
  );
  await page.route('**/functions/v1/promotions', (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'health')
      return route.fulfill({
        json: {
          schema_ready: true,
          email_configured: true,
          worker_ready: true,
          birthday_ready: true,
        },
      });
    expect(body.action).toBe('birthday-save');
    saved = body;
    return route.fulfill({ json: { saved: true } });
  });
  await page.goto('/admin/kuponi');
  await page.getByRole('button', { name: 'Postavke rođendanske promocije' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/Vrijedi od/)).toHaveCount(0);
  await expect(dialog.getByLabel(/Vrijedi do/)).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: 'Primatelji' })).toHaveCount(0);
  await expect(dialog.getByLabel('Valjanost rođendanskog koda (dana)')).toHaveValue('30');
  await expect(dialog.getByLabel('Uključi godišnje rođendanske poruke')).toBeChecked();
  await dialog.getByLabel('Vrijednost (%)').fill('20');
  await dialog.getByRole('button', { name: 'Spremi automatsku rođendansku promociju' }).click();
  await expect(dialog).toHaveCount(0);
  expect(saved).toMatchObject({
    action: 'birthday-save',
    occasion: 'birthday',
    value: 20,
    validity_days: 30,
    active: true,
    starts_at: null,
    expires_at: null,
    user_ids: null,
  });
  await expect(
    page.getByText('Uključeno · 20 % · kod vrijedi 30 dana od rođendana.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Postavke rođendanske promocije' }).click();
  await expect(dialog.getByLabel('Vrijednost (%)')).toHaveValue('20');
  await dialog.getByLabel('Uključi godišnje rođendanske poruke').uncheck();
  await dialog.getByRole('button', { name: 'Spremi automatsku rođendansku promociju' }).click();
  await expect(
    page.getByText('Isključeno · 20 % · kod vrijedi 30 dana od rođendana.'),
  ).toBeVisible();
});

test('korisnik sprema i uklanja dan i mjesec rođenja u profilu', async ({ page }) => {
  await workspaceFixture(page);
  let profile = {
    id: fixtureUser,
    first_name: 'Test',
    last_name: 'Korisnik',
    phone: '',
    marketing_consent: false,
    birthday_day: null as number | null,
    birthday_month: null as number | null,
  };
  await page.route('**/rest/v1/profiles**', async (route) => {
    if (route.request().method() === 'PATCH')
      profile = { ...profile, ...route.request().postDataJSON() };
    await route.fulfill({ json: [profile] });
  });
  await page.goto('/app/profil');
  await page.getByLabel('Dan rođenja').selectOption('29');
  await page.getByLabel('Mjesec rođenja').selectOption('2');
  await page.getByRole('button', { name: 'Spremi profil', exact: true }).click();
  await expect.poll(() => profile.birthday_day).toBe(29);
  expect(profile.birthday_month).toBe(2);
  expect(profile.marketing_consent).toBe(false);
  await page.reload();
  await expect(page.getByLabel('Dan rođenja')).toHaveValue('29');
  await page.getByLabel('Dan rođenja').selectOption('');
  await page.getByLabel('Mjesec rođenja').selectOption('');
  await page.getByRole('button', { name: 'Spremi profil', exact: true }).click();
  await expect.poll(() => profile.birthday_day).toBeNull();
  expect(profile.birthday_month).toBeNull();
});

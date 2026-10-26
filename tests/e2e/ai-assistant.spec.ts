import { test, expect } from '@playwright/test';
import { workspaceFixture } from '../fixtures/workspace';
test('AI razgovor je globalan, pamti kontekst i prikazuje odgovor kao siguran tekst', async ({
  page,
}, testInfo) => {
  await workspaceFixture(page);
  const calls: any[] = [];
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/functions/v1/ai-assistant', async (route) => {
    calls.push(route.request().postDataJSON());
    if (calls.length === 1) await wait;
    await route.fulfill({
      json: {
        answer:
          calls.length === 1
            ? 'Kod 50/50 pregledate rad prije druge uplate.'
            : '<img src=x onerror=alert(1)> Ovo je tekst, a ne HTML.',
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Otvori FormaPoint AI asistenta' }).click();
  const chat = page.getByRole('dialog');
  await expect(
    chat.getByText('Pozdrav! Ja sam FormaPoint AI asistent. Kako vam mogu pomoći danas?'),
  ).toBeVisible();
  await page.getByLabel('Pitanje za AI asistenta').fill('Kako radi 50/50?');
  await page.getByRole('button', { name: 'Pošalji pitanje' }).click();
  await expect(page.getByRole('status', { name: 'Asistent priprema odgovor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pošalji pitanje' })).toBeDisabled();
  release();
  await expect(chat.getByText('Kod 50/50 pregledate rad prije druge uplate.')).toBeVisible();
  await page.screenshot({ path: `/tmp/formapoint-ai-${testInfo.project.name}.png` });
  await chat.getByRole('link', { name: 'Česta pitanja' }).click();
  await expect(page).toHaveURL(/\/faq$/);
  await page.getByRole('button', { name: 'Otvori FormaPoint AI asistenta' }).click();
  await expect(chat.getByText('Kod 50/50 pregledate rad prije druge uplate.')).toBeVisible();
  await page.getByLabel('Pitanje za AI asistenta').fill('Kada mogu preuzeti?');
  await page.getByLabel('Pitanje za AI asistenta').press('Enter');
  await expect(
    chat.getByText('<img src=x onerror=alert(1)> Ovo je tekst, a ne HTML.'),
  ).toBeVisible();
  await expect(chat.locator('img')).toHaveCount(0);
  expect(calls[1].messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user']);
  expect(calls[1].messages[1].content).toContain('50/50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Novi razgovor' }).click();
  await expect(chat.getByText('Kod 50/50 pregledate rad prije druge uplate.')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(chat).toHaveCount(0);
});
test('gost može pitati bez prijave, a greška ne glumi AI odgovor', async ({ page }) => {
  await workspaceFixture(page, { signedIn: false });
  await page.route('**/functions/v1/ai-assistant', (route) =>
    route.fulfill({ status: 503, json: { error: 'AI asistent trenutačno nije dostupan.' } }),
  );
  await page.goto('/usluge');
  await page.getByRole('button', { name: 'Otvori FormaPoint AI asistenta' }).click();
  await page.getByLabel('Pitanje za AI asistenta').fill('Kako naručiti?');
  await page.getByRole('button', { name: 'Pošalji pitanje' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'AI asistent trenutačno nije dostupan.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/usluge$/);
  await page.getByRole('button', { name: 'Uredi pitanje i pokušaj ponovno' }).click();
  await expect(page.getByLabel('Pitanje za AI asistenta')).toHaveValue('Kako naručiti?');
});

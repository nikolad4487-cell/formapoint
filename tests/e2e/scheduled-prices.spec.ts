import { test, expect } from '@playwright/test';
import { fixtureServices, workspaceFixture } from '../fixtures/workspace';

test.describe('Zakazane cijene prema vremenu Hrvatske', () => {
  test.use({ timezoneId: 'America/New_York' });
  test('administrator vidi raspored, zakazuje novu cijenu i može je otkazati', async ({ page }) => {
    await workspaceFixture(page, { admin: true });
    let changes: any[] = [
      {
        id: 'b2000000-0000-4000-8000-000000000001',
        service_name: 'Završni rad - izrada',
        category_name: 'Završni radovi',
        new_price_cents: 8000,
        starts_at: '2030-12-31T23:00:00Z',
        status: 'pending',
        last_error: null,
      },
    ];
    let captured: any;
    await page.route('**/rest/v1/rpc/price_schedule_health', (route) =>
      route.fulfill({ json: { worker_ready: true, changes } }),
    );
    await page.route('**/rest/v1/rpc/schedule_service_price', (route) => {
      captured = route.request().postDataJSON();
      changes.push({
        id: 'b2000000-0000-4000-8000-000000000002',
        service_name: fixtureServices[0].name,
        category_name: fixtureServices[0].category,
        new_price_cents: captured.p_price,
        starts_at: captured.p_starts,
        status: 'pending',
      });
      return route.fulfill({ json: changes[1].id });
    });
    await page.route('**/rest/v1/rpc/cancel_service_price', (route) => {
      const id = route.request().postDataJSON().p_id;
      changes = changes.map((change) =>
        change.id === id ? { ...change, status: 'cancelled' } : change,
      );
      return route.fulfill({ json: null });
    });
    await page.goto('/admin/usluge');
    await expect(page.getByRole('heading', { name: 'Zakazane promjene cijena' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Završni rad - izrada' })).toContainText(
      '80,00',
    );
    await page.getByRole('button', { name: 'Zakaži cijenu', exact: true }).first().click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Nova cijena (€)').fill('20');
    await editor.getByLabel('Vrijedi od (vrijeme Hrvatske)').fill('2031-01-01T00:00');
    await editor.getByRole('button', { name: 'Zakaži novu cijenu' }).click();
    await expect(editor).toHaveCount(0);
    expect(captured.p_price).toBe(2000);
    expect(captured.p_starts).toBe('2030-12-31T23:00:00.000Z');
    await page.getByRole('button', { name: 'Otkaži promjenu', exact: true }).first().click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Otkaži zakazanu promjenu' })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Završni rad - izrada' })).toContainText(
      'Otkazano',
    );
  });
});

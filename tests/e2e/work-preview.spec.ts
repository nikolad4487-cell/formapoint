import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { workspaceFixture, fixtureOrders } from '../fixtures/workspace';
const originalId = '22222222-2222-4222-8222-222222222222';
const previewId = '33333333-3333-4333-8333-333333333333';
function pdf() {
  const stream = 'BT /F1 20 Tf 30 140 Td (FormaPoint preview example) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 220] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(output));
    output += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}
test('admin objavljuje zaseban JPEG pregled PDF-a i traži drugu uplatu', async ({
  page,
}, testInfo) => {
  await workspaceFixture(page, { admin: true, stripe: true });
  const uploaded: { kind: string; name: string; bytes: Buffer }[] = [];
  const approvals: Record<string, unknown>[] = [];
  const statuses: string[] = [];
  await page.route('**/rest/v1/orders?*', (route) =>
    route.fulfill({
      json: route.request().headers()['accept']?.includes('vnd.pgrst.object')
        ? fixtureOrders[0]
        : [fixtureOrders[0]],
    }),
  );
  await page.route('**/functions/v1/upload', async (route) => {
    const form = await new Response(route.request().postDataBuffer(), {
      headers: { 'Content-Type': route.request().headers()['content-type'] },
    }).formData();
    const file = form.get('file') as File;
    uploaded.push({
      kind: String(form.get('kind')),
      name: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    await route.fulfill({
      json: { ok: true, file_id: uploaded.length === 1 ? originalId : previewId },
    });
  });
  await page.route('**/rest/v1/rpc/mark_file_scanned', async (route) => {
    approvals.push(route.request().postDataJSON());
    await route.fulfill({ json: null });
  });
  await page.route('**/rest/v1/rpc/transition_order', async (route) => {
    statuses.push(route.request().postDataJSON().p_status);
    await route.fulfill({ json: null });
  });
  await page.goto(`/admin/narudzbe/${fixtureOrders[0].id}`);
  await page
    .getByLabel('Dodaj datoteke · do 20 MB po datoteci')
    .setInputFiles({ name: 'gotov-rad.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByRole('button', { name: 'Prenesi rad i objavi pregled' }).click();
  await expect.poll(() => statuses, { timeout: 20000 }).toEqual(['work_done', 'final_pending']);
  expect(uploaded.map((file) => file.kind)).toEqual(['final', 'preview']);
  expect(uploaded[0].bytes).toEqual(pdf());
  expect(uploaded[1].bytes.subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]));
  expect(uploaded[1].name).toMatch(/\.jpg$/);
  expect(approvals).toMatchObject([{ p_file: previewId, p_status: 'clean' }]);
  expect(approvals.some((value) => value.p_file === originalId)).toBe(false);
  if (testInfo.project.name === 'workspace-desktop')
    await writeFile('/tmp/formapoint-work-preview.jpg', uploaded[1].bytes);
});
test('kupac pregledava zaseban pregled, a original se otključava nakon druge uplate', async ({
  page,
}) => {
  await workspaceFixture(page, { stripe: true });
  let paid = 1251;
  const files = [
    {
      id: originalId,
      name: 'Zavrsni-rad.pdf',
      kind: 'final',
      order_id: fixtureOrders[0].id,
      scan_status: 'clean',
      size: 1024,
      path: 'private/original.pdf',
      created_at: '2026-10-25T12:00:00Z',
    },
    {
      id: previewId,
      name: 'Pregled-rada.jpg',
      kind: 'preview',
      order_id: fixtureOrders[0].id,
      scan_status: 'clean',
      size: 512,
      path: 'private/preview.jpg',
      created_at: '2026-10-25T12:00:00Z',
    },
  ];
  await page.route('**/rest/v1/orders?*', (route) =>
    route.fulfill({
      json: [
        {
          ...fixtureOrders[0],
          status: paid === 2501 ? 'delivered' : 'final_pending',
          paid_cents: paid,
        },
      ],
    }),
  );
  await page.route('**/rest/v1/order_files?*', (route) => route.fulfill({ json: files }));
  await page.route('**/functions/v1/download', async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ file_id: previewId, action: 'preview' });
    await route.fulfill({
      json: { url: 'http://127.0.0.1:54321/storage/v1/object/sign/order-files/preview.jpg' },
    });
  });
  const raster = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    return canvas.toDataURL('image/jpeg').split(',')[1];
  });
  await page.route('**/storage/v1/object/sign/order-files/preview.jpg', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: Buffer.from(raster, 'base64') }),
  );
  await page.goto(`/app/narudzbe/${fixtureOrders[0].id}`);
  await expect(page.getByRole('button', { name: 'Zaključano do cijele uplate' })).toBeDisabled();
  await page.getByRole('button', { name: 'Pregledaj rad' }).click();
  await expect(
    page.getByRole('dialog').getByRole('img', { name: 'Pregled rada — stranica 1' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Zatvori', exact: true }).click();
  paid = 2501;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Preuzmi', exact: true })).toBeEnabled();
});

test('objava jednokratno plaćenog rada ne traži drugu uplatu', async ({ page }) => {
  await workspaceFixture(page, { admin: true, stripe: true });
  const order = { ...fixtureOrders[0], payment_model: 'full', paid_cents: 2501 };
  await page.route('**/rest/v1/orders?*', (route) =>
    route.fulfill({
      json: route.request().headers()['accept']?.includes('vnd.pgrst.object') ? order : [order],
    }),
  );
  let uploads = 0,
    statusChanges = 0;
  await page.route('**/functions/v1/upload', async (route) => {
    uploads++;
    await route.fulfill({ json: { ok: true, file_id: uploads === 1 ? originalId : previewId } });
  });
  await page.route('**/rest/v1/rpc/mark_file_scanned', (route) => route.fulfill({ json: null }));
  await page.route('**/rest/v1/rpc/transition_order', async (route) => {
    statusChanges++;
    await route.fulfill({ json: null });
  });
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.goto(`/admin/narudzbe/${order.id}`);
  await page
    .getByLabel('Dodaj datoteke · do 20 MB po datoteci')
    .setInputFiles({
      name: 'rad.png',
      mimeType: 'image/png',
      buffer: Buffer.from(source, 'base64'),
    });
  await page.getByRole('button', { name: 'Prenesi rad i objavi pregled' }).click();
  await expect(
    page.getByText(
      'Pregled je objavljen. Izvornici ostaju dostupni prema provjeri uplate i sigurnosnoj provjeri.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(uploads).toBe(2);
  expect(statusChanges).toBe(0);
});

import type { Page } from '@playwright/test';
import { catalog } from '../../src/lib/catalog';
// Isključivo browser fixture: nije uključen u aplikaciju niti daje pristup stvarnoj bazi.
export const fixtureUser = '11111111-1111-4111-8111-111111111111';
export const fixtureServices = catalog.map((s, i) => ({
  ...s,
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  price_cents: 2501,
  split_enabled: true,
  split_min_cents: 200,
  delivery_days: 3,
  created_at: '2026-10-01T10:00:00Z',
}));
export const fixtureOrders = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    number: 'FP-TEST-001',
    title: 'Testna prezentacija',
    description: 'Isključivo testni opis narudžbe za browser provjere.',
    status: 'in_progress',
    total_cents: 2501,
    paid_cents: 1251,
    payment_model: 'split',
    due_at: '2026-12-01T10:00:00Z',
    created_at: '2026-10-20T10:00:00Z',
    user_id: fixtureUser,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    number: 'FP-TEST-002',
    title: 'Testni dokument',
    description: 'Isključivo testni dokument za provjeru prikaza.',
    status: 'final_pending',
    total_cents: 2501,
    paid_cents: 1251,
    payment_model: 'split',
    due_at: '2026-12-01T10:00:00Z',
    created_at: '2026-10-19T10:00:00Z',
    user_id: fixtureUser,
  },
];
export async function workspaceFixture(
  page: Page,
  {
    admin = false,
    empty = false,
    fail = false,
  }: { admin?: boolean; empty?: boolean; fail?: boolean } = {},
) {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const user = {
    id: fixtureUser,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.invalid',
    user_metadata: { first_name: 'Test', last_name: 'Korisnik' },
    app_metadata: { provider: 'email' },
    created_at: '2026-10-01T10:00:00Z',
  };
  await page.addInitScript(
    (session) => localStorage.setItem('sb-127-auth-token', JSON.stringify(session)),
    {
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: fixtureUser, role: 'authenticated', exp: expiry })}.test-signature`,
      refresh_token: 'test-only-refresh-token',
      expires_in: 3600,
      expires_at: expiry,
      token_type: 'bearer',
      user,
    },
  );
  let items = empty
    ? []
    : [
        {
          id: 'cart-test',
          service_id: fixtureServices[0].id,
          quantity: 1,
          services: fixtureServices[0],
        },
      ];
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').at(-1) || '';
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Content-Type': 'application/json',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname.includes('/auth/v1/')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ user }) });
      return;
    }
    if (table === 'cart_set') {
      const value = request.postDataJSON();
      if (value.p_quantity === 0) items = items.filter((i) => i.service_id !== value.p_service);
      else {
        const item = items.find((i) => i.service_id === value.p_service);
        if (item) item.quantity = value.p_quantity;
      }
      await route.fulfill({ status: 200, headers, body: 'null' });
      return;
    }
    if (fail && !['user_roles', 'site_settings'].includes(table)) {
      await route.fulfill({
        status: 500,
        headers,
        body: JSON.stringify({ message: 'Testna pogreška API-ja' }),
      });
      return;
    }
    const tables: Record<string, unknown> = {
      user_roles: [{ user_id: fixtureUser, role: admin ? 'ADMIN' : 'CUSTOMER' }],
      services: fixtureServices,
      site_settings: {
        stripe_enabled: false,
        maintenance: true,
        created_at: '2026-10-01T10:00:00Z',
      },
      orders: empty ? [] : fixtureOrders,
      cart_items: items,
      payments: empty
        ? []
        : [
            {
              id: 'payment-test',
              order_id: fixtureOrders[0].id,
              amount_cents: 1251,
              refunded_cents: 0,
              fee_cents: 42,
              provider: 'stripe',
              status: 'succeeded',
              created_at: '2026-10-20T10:00:00Z',
            },
          ],
      order_messages: [],
      order_files: [],
      audit_logs: [],
      notifications: [],
    };
    let data = tables[table] ?? [];
    const id = url.searchParams.get('id');
    if (id && Array.isArray(data)) data = data.filter((x) => x.id === id.replace('eq.', ''));
    if (table === 'site_settings' && !request.headers()['accept']?.includes('vnd.pgrst.object'))
      data = [data];
    await route.fulfill({ status: 200, headers, body: JSON.stringify(data) });
  });
}

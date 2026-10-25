import { strict as assert } from 'node:assert';
Deno.test(
  'Checkout normalizira APP_URL i odbija neispravnu konfiguraciju prije rezervacije',
  async (t) => {
    const originalServe = Deno.serve,
      originalFetch = globalThis.fetch;
    let handler: (req: Request) => Promise<Response>;
    let reservations = 0;
    let sessionForm: URLSearchParams | null = null;
    const orderId = '11111111-1111-4111-8111-111111111111';
    for (const [key, value] of Object.entries({
      SUPABASE_URL: 'https://test.supabase.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      STRIPE_SECRET_KEY: 'sk_test_local_fixture',
      APP_URL: 'https://www.formapoint.online/',
    }))
      Deno.env.set(key, value);
    Deno.serve = ((fn: (req: Request) => Promise<Response>) => {
      handler = fn;
      return {};
    }) as unknown as typeof Deno.serve;
    globalThis.fetch = async (input, init) => {
      const req = new Request(input, init),
        url = new URL(req.url);
      const json = (data: unknown) =>
        new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.pathname === '/auth/v1/user')
        return json({
          id: orderId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.invalid',
        });
      if (url.pathname === '/rest/v1/rpc/rate_limit') return json(null);
      if (url.pathname === '/rest/v1/rpc/reserve_payment') {
        reservations++;
        return json({
          id: '22222222-2222-4222-8222-222222222222',
          amount_cents: 100,
          installment: 1,
          provider_session_id: null,
          created_at: new Date().toISOString(),
        });
      }
      if (url.hostname === 'api.stripe.com' && url.pathname === '/v1/checkout/sessions') {
        sessionForm = new URLSearchParams(await req.text());
        return json({
          id: 'cs_test_fixture',
          object: 'checkout.session',
          url: 'https://checkout.stripe.com/c/pay/cs_test_fixture',
        });
      }
      if (url.pathname === '/rest/v1/payments' && req.method === 'PATCH') return json(null);
      throw new Error(`Unexpected test endpoint ${url.pathname}`);
    };
    try {
      await import('../checkout/index.ts');
      await t.step('OPTIONS dopušta obje stvarne domene i ne pokreće naplatu', async () => {
        for (const origin of ['https://www.formapoint.online', 'https://formapoint.online']) {
          const response = await handler(
            new Request('https://test.invalid/checkout', {
              method: 'OPTIONS',
              headers: { Origin: origin },
            }),
          );
          assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
          assert.equal(response.status, 200);
        }
        assert.equal(reservations, 0);
      });
      await t.step('uspješan zahtjev ima ispravnu povratnu adresu i iznos', async () => {
        const response = await handler(
          new Request('https://test.invalid/checkout', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token',
              Origin: 'https://formapoint.online',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ order_id: orderId }),
          }),
        );
        assert.equal(response.status, 200);
        assert.equal(
          response.headers.get('Access-Control-Allow-Origin'),
          'https://formapoint.online',
        );
        assert.deepEqual(await response.json(), {
          url: 'https://checkout.stripe.com/c/pay/cs_test_fixture',
        });
        assert.equal(reservations, 1);
        assert.ok(sessionForm);
        assert.equal(
          sessionForm!.get('success_url'),
          `https://www.formapoint.online/app/narudzbe/${orderId}?uplata=obrada`,
        );
        assert.equal(sessionForm!.get('line_items[0][price_data][unit_amount]'), '100');
      });
      await t.step('neispravan APP_URL ne rezervira novu uplatu', async () => {
        Deno.env.set('APP_URL', 'https://www.formapoint.online/neispravna-putanja');
        const response = await handler(
          new Request('https://test.invalid/checkout', {
            method: 'POST',
            headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId }),
          }),
        );
        assert.equal(response.status, 400);
        assert.equal(reservations, 1);
      });
    } finally {
      Deno.serve = originalServe;
      globalThis.fetch = originalFetch;
    }
  },
);

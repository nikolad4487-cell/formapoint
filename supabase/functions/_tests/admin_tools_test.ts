// Network is denied by the test command. All external calls below are explicit local adapters.
import { strict as assert } from 'node:assert';
Deno.test('Admin Edge provjerava identitet, ulogu i odjavu prije bilo kakvog slanja', async (t) => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  let handler: (req: Request) => Promise<Response>;
  let role = 'CUSTOMER';
  let jobs: Record<string, unknown>[] = [];
  const calls: string[] = [];
  let sentEmails = 0;
  for (const [key, value] of Object.entries({
    SUPABASE_URL: 'https://edge-test.supabase.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SUPABASE_ANON_KEY: 'test-public-key',
    APP_URL: 'https://app.example.invalid',
    CRON_SECRET: 'test-cron-secret',
    RESEND_API_KEY: 'test-mail-key',
    EMAIL_FROM: 'test@example.invalid',
  }))
    Deno.env.set(key, value);
  Deno.serve = ((fn: (req: Request) => Promise<Response>) => {
    handler = fn;
    return {};
  }) as unknown as typeof Deno.serve;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url.pathname);
    const response = (data: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    if (url.pathname === '/auth/v1/user')
      return response({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'admin@example.invalid',
        role: 'authenticated',
        aud: 'authenticated',
      });
    if (url.pathname === '/rest/v1/user_roles')
      return response(role === 'ADMIN' ? [{ role: 'ADMIN' }] : []);
    if (url.pathname === '/rest/v1/rpc/rate_limit') return response(null);
    if (url.pathname === '/rest/v1/rpc/claim_newsletter') {
      const claimed = jobs;
      jobs = [];
      return response(claimed);
    }
    if (url.pathname === '/rest/v1/newsletter_deliveries')
      return response(init?.method === 'PATCH' ? null : { subscriber_id: 'subscriber-test' });
    if (url.pathname === '/rest/v1/newsletter_subscribers')
      return response({
        user_id: 'user-test',
        email: 'subscriber@example.invalid',
        status: 'unsubscribed',
        confirmed_at: '2026-10-01T10:00:00Z',
      });
    if (url.pathname === '/rest/v1/newsletter_templates')
      return response({
        id: '11111111-1111-4111-8111-111111111111',
        subject: 'Testna poruka',
        html: '<p>Test</p>',
      });
    if (url.pathname === '/rest/v1/newsletter_campaigns')
      return response({
        id: '22222222-2222-4222-8222-222222222222',
        template_id: '11111111-1111-4111-8111-111111111111',
        status: 'queued',
      });
    if (url.pathname === '/rest/v1/profiles') return response({ marketing_consent: false });
    if (url.hostname === 'api.resend.com') {
      sentEmails++;
      return response({ id: 'mail-test' });
    }
    throw new Error(`Unexpected mocked endpoint: ${url.pathname}`);
  };
  try {
    await import('../admin-tools/index.ts');
    const request = (body: unknown, token?: string) =>
      handler(
        new Request('https://edge-test.supabase.invalid/functions/v1/admin-tools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        }),
      );
    await t.step('bez sesije nema pristupa ni statusu integracije', async () => {
      const r = await request({ action: 'health' });
      assert.equal(r.status, 400);
      assert.equal(calls.length, 0);
    });
    await t.step('potvrđen kupac ne dobiva admin ovlasti', async () => {
      const r = await request({ action: 'health' }, 'test-user-token');
      assert.equal(r.status, 403);
    });
    await t.step('administrator može provjeriti status', async () => {
      role = 'ADMIN';
      const r = await request({ action: 'health' }, 'test-admin-token');
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { email_configured: true, invites_available: true });
    });
    await t.step('nevaljana cron tajna ne preuzima poslove', async () => {
      role = 'CUSTOMER';
      const before = calls.filter((p) => p.endsWith('claim_newsletter')).length;
      const r = await request({ action: 'process-newsletter' }, 'wrong-cron');
      assert.equal(r.status, 403);
      assert.equal(calls.filter((p) => p.endsWith('claim_newsletter')).length, before);
    });
    await t.step('worker preskače odjavljenu adresu iako je posao ranije dopušten', async () => {
      jobs = [
        {
          id: 'delivery-test',
          allowed: true,
          email: 'subscriber@example.invalid',
          subject: 'Test',
          html: '<p>Test</p>',
          token: 'optout-test',
        },
      ];
      const r = await request({ action: 'process-newsletter' }, 'test-cron-secret');
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { sent: 0, failed: 0, skipped: 1 });
      assert.equal(sentEmails, 0);
    });
    await t.step('ponavljanje istog zahtjeva ne stvara novu kampanju', async () => {
      role = 'ADMIN';
      const before = calls.length;
      const r = await request(
        {
          action: 'send-newsletter',
          template_id: '11111111-1111-4111-8111-111111111111',
          campaign_id: '22222222-2222-4222-8222-222222222222',
        },
        'test-admin-token',
      );
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), {
        campaign_id: '22222222-2222-4222-8222-222222222222',
        already_queued: true,
      });
      assert.equal(
        calls.slice(before).some((p) => p.endsWith('queue_newsletter')),
        false,
      );
      assert.equal(sentEmails, 0);
    });
    await t.step('prazan red ne stvara izmišljena slanja', async () => {
      const r = await request({ action: 'process-newsletter' }, 'test-cron-secret');
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { sent: 0, failed: 0, skipped: 0 });
      assert.equal(sentEmails, 0);
    });
  } finally {
    Deno.serve = originalServe;
    globalThis.fetch = originalFetch;
  }
});

import { strict as assert } from 'node:assert';
Deno.test(
  'Promocije provjeravaju administratora, privolu, personalizaciju i stvarnu potvrdu slanja',
  async (t) => {
    const originalServe = Deno.serve,
      originalFetch = globalThis.fetch;
    let handler: (req: Request) => Promise<Response>;
    let future = false;
    let scheduleReady = false;
    let deferred = 0;
    let role = 'CUSTOMER',
      allowed = true,
      hasJob = false,
      providerOk = true,
      workerAllowed = false;
    let retries = 0;
    let sent = 0,
      created = 0;
    let statuses: string[] = [];
    let email: any;
    let seenCreate: any;
    const campaign = 'd8000000-0000-4000-8000-000000000001',
      delivery = 'd8000000-0000-4000-8000-000000000002',
      claim = 'd8000000-0000-4000-8000-000000000003';
    for (const [k, v] of Object.entries({
      SUPABASE_URL: 'https://promotions-test.supabase.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service',
      SUPABASE_ANON_KEY: 'test-public',
      APP_URL: 'https://www.formapoint.online',
      CRON_SECRET: 'test-cron',
      RESEND_API_KEY: 'test-resend',
      EMAIL_FROM: 'info@example.invalid',
    }))
      Deno.env.set(k, v);
    Deno.serve = ((fn: typeof handler) => {
      handler = fn;
      return {};
    }) as unknown as typeof Deno.serve;
    globalThis.fetch = async (input, init) => {
      const req = new Request(input, init),
        url = new URL(req.url);
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.hostname === 'api.resend.com') {
        sent++;
        email = await req.json();
        assert.equal(req.headers.get('idempotency-key'), `promotion-${delivery}`);
        return providerOk
          ? json({ id: 'provider-confirmed-id' })
          : json({ message: 'rejected' }, 500);
      }
      assert.equal(url.hostname, 'promotions-test.supabase.invalid');
      if (url.pathname === '/auth/v1/user')
        return json({
          id: '33333333-3333-4333-8333-333333333333',
          aud: 'authenticated',
          role: 'authenticated',
        });
      if (url.pathname === '/rest/v1/user_roles')
        return json(role === 'ADMIN' ? [{ role: 'ADMIN' }] : []);
      if (url.pathname.endsWith('/rate_limit')) return json(null);
      if (url.pathname === '/rest/v1/promotion_deliveries') {
        const update = await req.json();
        if (update.claim_token === null) {
          deferred++;
          assert.equal(update.status, 'pending');
          assert.equal(update.attempts, 0);
          assert.equal(update.first_attempt_at, null);
          return json(null);
        }
        retries++;
        assert.equal(update.attempts, 0);
        assert.equal(update.first_attempt_at, undefined);
        assert(url.searchParams.get('first_attempt_at')?.startsWith('gt.'));
        return json(null);
      }
      if (url.pathname.endsWith('/promotion_schedule_ready')) return json(scheduleReady);
      if (url.pathname.endsWith('/promotion_worker_authorized')) return json(workerAllowed);
      if (url.pathname.endsWith('/create_personal_promotion')) {
        created++;
        seenCreate = await req.json();
        assert.equal(req.headers.get('authorization'), 'Bearer administrator-token');
        return json(campaign);
      }
      if (url.pathname.endsWith('/claim_promotions')) {
        const result = hasJob ? [{ id: delivery, claim_token: claim }] : [];
        hasJob = false;
        return json(result);
      }
      if (url.pathname.endsWith('/promotion_delivery_data'))
        return json({
          id: delivery,
          allowed,
          token: 'unsubscribe-token',
          email: 'ana@example.invalid',
          recipient_name: 'Ana <script>',
          occasion: 'christmas',
          code: 'BOZIC-PERSONAL',
          kind: 'percent',
          value: 15,
          attempts: 1,
          first_attempt_at: new Date().toISOString(),
          starts_at: future
            ? new Date(Date.now() + 86400000).toISOString()
            : '2026-10-01T10:00:00Z',
          expires_at: '2026-12-31T10:00:00Z',
          subject: 'Poklon za {ime}',
          message: 'Pozdrav {ime}! Kod {kod}, popust {popust}, od {od} do {do}.',
          image_url: 'https://www.formapoint.online/promotions/christmas.jpg',
        });
      if (url.pathname.endsWith('/finish_promotion_delivery')) {
        statuses.push((await req.json()).p_status);
        return json(null);
      }
      throw new Error('Unexpected endpoint ' + url.pathname);
    };
    const request = (body: unknown, token = 'administrator-token') =>
      handler(
        new Request('https://edge.invalid/promotions', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
    const create = {
      action: 'create',
      request_id: campaign,
      name: 'Božić',
      occasion: 'christmas',
      kind: 'percent',
      value: 15,
      subject: 'Poklon za {ime}',
      message: 'Tvoj osobni kod je {kod}.',
      user_ids: ['11111111-1111-4111-8111-111111111111'],
    };
    try {
      await import('../promotions/index.ts');
      await t.step('korisnik i pogrešan worker ključ ne stvaraju kodove niti šalju', async () => {
        assert.equal((await request(create)).status, 403);
        assert.equal((await request({ action: 'process' }, 'f'.repeat(64))).status, 403);
        assert.equal(sent, 0);
        assert.equal(created, 0);
      });
      await t.step('nedostajuća konfiguracija zaustavlja kreiranje prije baze', async () => {
        role = 'ADMIN';
        Deno.env.delete('RESEND_API_KEY');
        assert.equal((await request(create)).status, 503);
        assert.equal(created, 0);
        Deno.env.set('RESEND_API_KEY', 'test-resend');
      });
      await t.step(
        'izrada koristi JWT administratora i poslužiteljski javni URL slike',
        async () => {
          const response = await request(create);
          assert.equal(response.status, 200);
          assert.equal((await response.json()).campaign_id, campaign);
          assert.equal(
            seenCreate.p_image_url,
            'https://www.formapoint.online/promotions/christmas.jpg',
          );
          assert.equal(seenCreate.p_expires, null);
          assert.equal(seenCreate.p_request, campaign);
        },
      );
      await t.step('buduća promocija traži nadogradnju rasporeda prije izrade kodova', async () => {
        const before = created;
        const starts = new Date(Date.now() + 40 * 86400000).toISOString();
        assert.equal((await request({ ...create, starts_at: starts })).status, 400);
        assert.equal(created, before);
        scheduleReady = true;
        assert.equal((await request({ ...create, starts_at: starts })).status, 200);
        assert.equal(seenCreate.p_starts, starts);
      });
      await t.step('odjava nakon kreiranja preskače slanje', async () => {
        hasJob = true;
        allowed = false;
        assert.equal((await request({ action: 'process' }, 'test-cron')).status, 200);
        assert.equal(sent, 0);
        assert.equal(statuses.at(-1), 'skipped');
      });
      await t.step('personalizirani tekst i HTML sadrže kod, rokove, sliku i odjavu', async () => {
        allowed = true;
        hasJob = true;
        statuses = [];
        const response = await request({ action: 'process', campaign_id: campaign });
        assert.equal((await response.json()).sent, 1);
        assert.equal(sent, 1);
        assert.equal(statuses.at(-1), 'sent');
        assert(email.subject.includes('Ana'));
        assert(email.html.includes('BOZIC-PERSONAL'));
        assert(email.html.includes('15 %'));
        assert(email.html.includes('christmas.jpg'));
        assert(email.html.includes('odjava-newslettera?token=unsubscribe-token'));
        assert(email.html.includes('&lt;script&gt;'));
        assert(!email.html.includes('<script>'));
        assert(email.text.includes('BOZIC-PERSONAL'));
      });
      await t.step('odbijeni e-mail nikad se ne označava kao poslan', async () => {
        providerOk = false;
        hasJob = true;
        const response = await request({ action: 'process' });
        const totals = await response.json();
        assert.equal(totals.sent, 0);
        assert.equal(totals.failed, 1);
        assert.equal(statuses.at(-1), 'failed');
      });
      await t.step(
        'budući kod se odgađa bez slanja čak i ako ga je stari red već rezervirao',
        async () => {
          const before = sent;
          hasJob = true;
          future = true;
          const response = await request({ action: 'process', campaign_id: campaign });
          assert.equal((await response.json()).deferred, 1);
          assert.equal(sent, before);
          assert.equal(deferred, 1);
          future = false;
        },
      );
      await t.step(
        'ručni ponovni pokušaj traži administratora i čuva izvorni prozor idempotencije',
        async () => {
          role = 'CUSTOMER';
          assert.equal(
            (await request({ action: 'process', campaign_id: campaign, retry: true })).status,
            403,
          );
          assert.equal(retries, 0);
          role = 'ADMIN';
          assert.equal(
            (await request({ action: 'process', campaign_id: campaign, retry: true })).status,
            200,
          );
          assert.equal(retries, 1);
        },
      );
      await t.step('interni potpisani worker obrađuje red bez korisničke prijave', async () => {
        workerAllowed = true;
        role = 'CUSTOMER';
        hasJob = false;
        assert.equal((await request({ action: 'process' }, 'e'.repeat(64))).status, 200);
      });
    } finally {
      Deno.serve = originalServe;
      globalThis.fetch = originalFetch;
    }
  },
);

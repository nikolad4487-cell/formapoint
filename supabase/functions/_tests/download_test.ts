import { strict as assert } from 'node:assert';
Deno.test('Završni original ostaje zaključan, a pregled je zasebna datoteka', async (t) => {
  const originalServe = Deno.serve,
    originalFetch = globalThis.fetch;
  let handler: (req: Request) => Promise<Response>;
  const uid = '11111111-1111-4111-8111-111111111111';
  const fid = '22222222-2222-4222-8222-222222222222';
  let role = 'CUSTOMER',
    owner = uid,
    kind = 'final',
    status = 'clean',
    paid = 500;
  let signed = 0;
  const audits: string[] = [];
  for (const [key, value] of Object.entries({
    SUPABASE_URL: 'https://files-test.supabase.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    APP_URL: 'https://formapoint.online',
  }))
    Deno.env.set(key, value);
  Deno.serve = ((fn: typeof handler) => {
    handler = fn;
    return {};
  }) as unknown as typeof Deno.serve;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init),
      url = new URL(req.url);
    const json = (value: unknown) =>
      new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/auth/v1/user')
      return json({ id: uid, aud: 'authenticated', role: 'authenticated' });
    if (url.pathname === '/rest/v1/order_files')
      return json({
        id: fid,
        order_id: fid,
        name: kind === 'final' ? 'original.pdf' : 'Pregled.jpg',
        path: kind === 'final' ? 'private/original.pdf' : 'private/preview.jpg',
        kind,
        scan_status: status,
      });
    if (url.pathname === '/rest/v1/orders')
      return json({
        user_id: owner,
        payment_model: 'split',
        total_cents: 1000,
        paid_cents: paid,
        download_override: true,
      });
    if (url.pathname === '/rest/v1/user_roles') return json([{ role }]);
    if (url.pathname.startsWith('/storage/v1/object/sign/order-files/')) {
      signed++;
      return json({ signedURL: `/object/sign/order-files/${kind}.pdf?token=fixture` });
    }
    if (url.pathname === '/rest/v1/audit_logs') {
      audits.push((await req.json()).action);
      return json(null);
    }
    throw new Error(`Unexpected endpoint ${url.pathname}`);
  };
  const request = (action?: string) =>
    handler(
      new Request('https://edge.invalid/download', {
        method: 'POST',
        headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fid, action }),
      }),
    );
  try {
    await import('../download/index.ts');
    await t.step(
      'neplaćeni original ne dobiva potpisanu poveznicu ni uz stari override',
      async () => {
        assert.equal((await request()).status, 403);
        assert.equal(signed, 0);
      },
    );
    await t.step('preview parametar ne zaobilazi zaključavanje originala', async () => {
      assert.equal((await request('preview')).status, 403);
      assert.equal(signed, 0);
    });
    await t.step('zaseban pregled može se otvoriti prije druge uplate', async () => {
      kind = 'preview';
      assert.equal((await request('preview')).status, 200);
      assert.equal(signed, 1);
      assert.deepEqual(audits, ['file.preview']);
    });
    await t.step('pregled nema akciju preuzimanja za kupca', async () => {
      assert.equal((await request()).status, 403);
      assert.equal(signed, 1);
    });
    await t.step('tuđi korisnik i neprovjerena datoteka nemaju pristup pregledu', async () => {
      owner = fid;
      assert.equal((await request('preview')).status, 400);
      owner = uid;
      status = 'quarantined';
      assert.equal((await request('preview')).status, 400);
      assert.equal(signed, 1);
      status = 'clean';
    });
    await t.step('original se potpisuje tek nakon cijele uplate', async () => {
      kind = 'final';
      paid = 1000;
      assert.equal((await request()).status, 200);
      assert.equal(signed, 2);
      assert.equal(audits.at(-1), 'file.download');
    });
    await t.step('administrator može pristupiti sigurnosno provjerenom originalu', async () => {
      role = 'ADMIN';
      paid = 500;
      assert.equal((await request()).status, 200);
      assert.equal(signed, 3);
    });
  } finally {
    Deno.serve = originalServe;
    globalThis.fetch = originalFetch;
  }
});

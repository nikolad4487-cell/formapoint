import { strict as assert } from 'node:assert';
Deno.test(
  'Prijenos čuva izvornik u karanteni i ograničava pregled na administrativne slike',
  async (t) => {
    const oldServe = Deno.serve,
      oldFetch = globalThis.fetch;
    let handler: (req: Request) => Promise<Response>;
    const uid = '11111111-1111-4111-8111-111111111111',
      oid = '22222222-2222-4222-8222-222222222222';
    let role = 'CUSTOMER',
      stored = 0,
      limit = 0;
    const records: Record<string, unknown>[] = [];
    for (const [key, value] of Object.entries({
      SUPABASE_URL: 'https://upload-test.supabase.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
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
      if (url.pathname === '/rest/v1/orders') return json({ user_id: uid });
      if (url.pathname === '/rest/v1/user_roles') return json([{ role }]);
      if (url.pathname === '/rest/v1/rpc/rate_limit') {
        limit = (await req.json()).max_hits;
        return json(null);
      }
      if (url.pathname.startsWith('/storage/v1/object/order-files/')) {
        stored++;
        return json({ Key: 'fixture' });
      }
      if (url.pathname === '/rest/v1/order_files') {
        records.push(await req.json());
        return json({ id: oid });
      }
      throw new Error(`Unexpected endpoint ${url.pathname}`);
    };
    const upload = (kind: string, name: string, bytes: Uint8Array) => {
      const form = new FormData();
      form.set('order_id', oid);
      form.set('kind', kind);
      form.set('file', new File([new Uint8Array(bytes)], name));
      return handler(
        new Request('https://edge.invalid/upload', {
          method: 'POST',
          headers: { Authorization: 'Bearer fixture' },
          body: form,
        }),
      );
    };
    try {
      await import('../upload/index.ts');
      await t.step('kupac ne objavljuje pregled ni završni rad', async () => {
        for (const kind of ['preview', 'final'])
          assert.equal(
            (await upload(kind, 'slika.jpg', new Uint8Array([255, 216, 255, 0]))).status,
            400,
          );
        assert.equal(stored, 0);
      });
      await t.step('PDF original ne postaje izravno dostupan kao pregled', async () => {
        role = 'ADMIN';
        assert.equal(
          (await upload('preview', 'rad.pdf', new TextEncoder().encode('%PDF-1.4'))).status,
          400,
        );
        assert.equal(stored, 0);
      });
      await t.step('zasebna slika pregleda dobiva vlastiti ID i čeka odobrenje', async () => {
        const res = await upload('preview', 'Pregled.jpg', new Uint8Array([255, 216, 255, 0]));
        assert.equal(res.status, 200);
        assert.equal((await res.json()).file_id, oid);
        assert.equal(records.at(-1)?.kind, 'preview');
        assert.equal(records.at(-1)?.scan_status, 'quarantined');
        assert.equal(limit, 500);
      });
      await t.step(
        'izvornik je zaseban final zapis koji nije automatski označen sigurnim',
        async () => {
          assert.equal(
            (await upload('final', 'rad.pdf', new TextEncoder().encode('%PDF-1.4'))).status,
            200,
          );
          assert.equal(records.at(-1)?.kind, 'final');
          assert.equal(records.at(-1)?.scan_status, 'quarantined');
        },
      );
      await t.step('obični korisnički privici zadržavaju ograničenje prijenosa', async () => {
        role = 'CUSTOMER';
        assert.equal(
          (await upload('attachment', 'upute.txt', new TextEncoder().encode('Testne upute.')))
            .status,
          200,
        );
        assert.equal(limit, 20);
      });
    } finally {
      Deno.serve = oldServe;
      globalThis.fetch = oldFetch;
    }
  },
);

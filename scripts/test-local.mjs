// Samo lokalni Supabase. Testni korisnici i objekti uklanjaju se nakon provjere.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
const binary = process.env.SUPABASE_CLI || '/workspace/.tools/formapoint/supabase';
const config = JSON.parse(
  execFileSync(binary, ['status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
assert(
  ['localhost', '127.0.0.1'].includes(new URL(config.API_URL).hostname),
  'Test dopušta isključivo lokalni Supabase.',
);
const db = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const client = () =>
  createClient(config.API_URL, config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const users = [],
  orders = [],
  services = [];
let browser;
let settings;
let checks = 0;
function pass(name) {
  checks++;
  console.log(`PASS: ${name}`);
}
async function must(result) {
  const { data, error } = await result;
  if (error) throw new Error(error.message);
  return data;
}
try {
  const customers = [];
  for (let i = 0; i < 3; i++) {
    const c = client(),
      email = `fp-${randomUUID()}@example.invalid`,
      password = randomUUID() + randomUUID();
    const signup = await must(
      c.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: 'Test',
            last_name: 'Korisnik',
            terms_accepted_at: new Date().toISOString(),
          },
        },
      }),
    );
    assert(signup.user);
    users.push(signup.user.id);
    assert(signup.session, 'Registracija mora odmah vratiti sesiju bez potvrde e-maila');
    await must(c.auth.signInWithPassword({ email, password }));
    customers.push({ c, email, password, id: signup.user.id });
  }
  pass('Registracija bez potvrde e-maila i stvarna prijava preko Auth API-ja');
  const [a, b, administrator] = customers;
  await must(db.from('user_roles').insert({ user_id: administrator.id, role: 'ADMIN' }));
  const service = await must(
    db
      .from('services')
      .insert({
        name: 'Testna usluga integracije',
        slug: `test-${randomUUID()}`,
        category: 'Tablice',
        description: 'Samo lokalni integracijski test.',
        price_cents: 2501,
        split_enabled: true,
        split_min_cents: 200,
      })
      .select()
      .single(),
  );
  services.push(service.id);
  await must(a.c.rpc('cart_set', { p_service: service.id, p_quantity: 2 }));
  const cart = await must(a.c.from('cart_items').select('*'));
  assert.equal(cart.length, 1);
  assert.equal((await must(b.c.from('cart_items').select('*'))).length, 0);
  pass('Stvarna trajna košarica i izolacija drugog korisnika');
  const oid = await must(
    a.c.rpc('create_order', {
      p_service: service.id,
      p_quantity: 1,
      p_title: 'Lokalni integracijski zadatak',
      p_description: 'Provjera narudžbe, komunikacije, privitaka i uplata.',
      p_model: 'split',
    }),
  );
  orders.push(oid);
  assert.equal((await must(b.c.from('orders').select('*').eq('id', oid))).length, 0);
  const denied = await a.c.from('orders').update({ paid_cents: 2501 }).eq('id', oid);
  assert(denied.error);
  pass('Narudžba privatna, klijent ne može upisati uplatu');
  await must(a.c.rpc('send_message', { p_order: oid, p_body: 'Poruka korisnika' }));
  await must(
    administrator.c.rpc('send_message', {
      p_order: oid,
      p_body: 'Privatna interna bilješka',
      p_internal: true,
    }),
  );
  assert.equal((await must(a.c.from('order_messages').select('*').eq('order_id', oid))).length, 1);
  pass('Poruke kroz REST i skrivanje interne bilješke');
  const form = new FormData();
  form.set('order_id', oid);
  form.set('kind', 'final');
  form.set(
    'file',
    new File(['Lokalna testna završna datoteka.'], 'rezultat.txt', { type: 'text/plain' }),
  );
  await must(administrator.c.functions.invoke('upload', { body: form }));
  const f = await must(db.from('order_files').select('*').eq('order_id', oid).single());
  assert.equal(f.scan_status, 'quarantined');
  const storageDenied = await a.c.storage.from('order-files').download(f.path);
  assert(storageDenied.error);
  const quarantine = await a.c.functions.invoke('download', { body: { file_id: f.id } });
  assert(quarantine.error);
  await must(
    administrator.c.rpc('mark_file_scanned', {
      p_file: f.id,
      p_status: 'clean',
      p_reason: 'Testna tekstualna datoteka generirana u kontroliranom integracijskom testu.',
    }),
  );
  const unpaid = await a.c.functions.invoke('download', { body: { file_id: f.id } });
  assert(unpaid.error);
  pass('Stvarni Storage upload, karantena i zabrana neplaćenog završnog rada');
  settings = await must(db.from('site_settings').select('*').single());
  await must(
    db.from('site_settings').update({ stripe_enabled: true, maintenance: false }).eq('id', true),
  );
  // Namjerno sintetički događaji testiraju DB adapter; ovo nije provjera stvarnog Stripe procesora.
  const p = await must(db.rpc('reserve_payment', { p_order: oid, p_user: a.id }));
  const event = {
    p_event: `test-${randomUUID()}`,
    p_type: 'checkout.session.completed',
    p_payment: p.id,
    p_session: `cs_test_${randomUUID()}`,
    p_intent: `pi_test_${randomUUID()}`,
    p_amount: 1251,
    p_currency: 'eur',
    p_status: 'succeeded',
  };
  await must(db.rpc('apply_stripe_event', event));
  await must(db.rpc('apply_stripe_event', event));
  let order = await must(a.c.from('orders').select('*').eq('id', oid).single());
  assert.equal(order.paid_cents, 1251);
  assert.equal(order.status, 'ready');
  await must(administrator.c.rpc('transition_order', { p_order: oid, p_status: 'in_progress' }));
  await must(administrator.c.rpc('transition_order', { p_order: oid, p_status: 'work_done' }));
  await must(administrator.c.rpc('transition_order', { p_order: oid, p_status: 'final_pending' }));
  const final = await must(db.rpc('reserve_payment', { p_order: oid, p_user: a.id }));
  await must(
    db.rpc('apply_stripe_event', {
      ...event,
      p_event: `test-${randomUUID()}`,
      p_payment: final.id,
      p_session: `cs_test_${randomUUID()}`,
      p_intent: `pi_test_${randomUUID()}`,
      p_amount: 1250,
    }),
  );
  order = await must(a.c.from('orders').select('*').eq('id', oid).single());
  assert.equal(order.paid_cents, 2501);
  assert.equal(order.status, 'delivered');
  const result = await must(a.c.functions.invoke('download', { body: { file_id: f.id } }));
  const response = await fetch(result.url);
  assert(response.ok);
  assert.equal(await response.text(), 'Lokalna testna završna datoteka.');
  const other = await b.c.functions.invoke('download', { body: { file_id: f.id } });
  assert(other.error);
  pass('Obje rate, idempotentnost DB adaptera i stvarno preuzimanje samo ovlaštenom vlasniku');
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/prijava');
  await page.getByLabel('E-mail adresa').fill(a.email);
  await page.getByLabel('Lozinka', { exact: true }).fill(a.password);
  await page.getByRole('button', { name: 'Prijavi se', exact: true }).click();
  await page.waitForURL('**/app');
  await page.getByRole('link', { name: 'Moje narudžbe', exact: true }).click();
  await page.getByRole('heading', { name: 'Lokalni integracijski zadatak' }).waitFor();
  await page.getByRole('button', { name: 'Odjava', exact: true }).click();
  await page.waitForURL('**/prijava');
  await page.getByLabel('E-mail adresa').fill(b.email);
  await page.getByLabel('Lozinka', { exact: true }).fill(b.password);
  await page.getByRole('button', { name: 'Prijavi se', exact: true }).click();
  await page.waitForURL('**/app/narudzbe');
  assert.equal(
    await page.getByRole('heading', { name: 'Lokalni integracijski zadatak' }).count(),
    0,
  );
  pass('Browser prijava, dashboard, odjava i izolacija cachea pri promjeni korisnika');
  console.log(
    `${checks} lokalnih integracijskih tokova prošlo. Stvarna Stripe naplata i slanje e-pošte vanjskom primatelju nisu testirani.`,
  );
} finally {
  await browser?.close();
  if (settings)
    await db
      .from('site_settings')
      .update({ stripe_enabled: settings.stripe_enabled, maintenance: settings.maintenance })
      .eq('id', true);
  for (const oid of orders) {
    const { data: files } = await db.from('order_files').select('path').eq('order_id', oid);
    if (files?.length) await db.storage.from('order-files').remove(files.map((f) => f.path));
    for (const table of [
      'order_files',
      'order_messages',
      'order_status_history',
      'order_items',
      'payment_installments',
      'payments',
      'quotes',
    ])
      await db.from(table).delete().eq('order_id', oid);
    await db.from('orders').delete().eq('id', oid);
  }
  for (const user of users) {
    await db.from('notification_outbox').delete().eq('user_id', user);
    await db.from('notifications').delete().eq('user_id', user);
    await db.auth.admin.deleteUser(user);
  }
  for (const id of services) {
    await db.from('service_price_history').delete().eq('service_id', id);
    await db.from('services').delete().eq('id', id);
  }
}

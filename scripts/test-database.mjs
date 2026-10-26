import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const name = `fp-test-${randomUUID().slice(0, 8)}`;
const image =
  'postgres:17-alpine@sha256:eee6c6e1b0894fa4fe0075eb054af9fd1cf39a35321c2d4110626cfe506411fb';
function sql(text) {
  const r = spawnSync(
    'docker',
    ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
    { input: text, encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(r.stderr + r.stdout);
  return (r.stderr.match(/NOTICE:  PASS: .*/g) || []).join('\n');
}
try {
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '-d',
      '--network',
      'none',
      '--name',
      name,
      '-e',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      image,
    ],
    { stdio: 'pipe' },
  );
  let ready = false;
  for (let n = 0; n < 50; n++) {
    const r = spawnSync(
      'docker',
      ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'],
      { stdio: 'ignore' },
    );
    if (r.status === 0) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw new Error('PostgreSQL nije spreman');
  sql(readFileSync('tests/db-bootstrap.sql', 'utf8'));
  for (const file of readdirSync('supabase/migrations')
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    if (file === '202610240008_payment_methods.sql')
      sql(
        `update public.site_settings set payment_icons='${JSON.stringify({ visa: 'https://example.invalid/previous-visa.png', keks: 'https://example.invalid/old-keks.png' })}'::jsonb;`,
      );
    if (file === '202610250011_bank_method.sql')
      sql(
        `insert into public.payment_methods(id,code,name,provider,icon_url)values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','custom_iban_fixture','IBAN','unconnected','https://example.invalid/uploaded-iban.png');`,
      );
    sql(
      readFileSync(
        [
          '202610240006_admin_tools.sql',
          '202610240007_icons_first_order.sql',
          '202610240008_payment_methods.sql',
          '202610250009_catalog_deletion.sql',
          '202610250010_cart_checkout.sql',
          '202610250011_bank_method.sql',
          '202610260012_guest_checkout.sql',
          '202610260013_category_service_slugs.sql',
        ].includes(file)
          ? `public/migracije/${file}`
          : `supabase/migrations/${file}`,
        'utf8',
      ),
    );
    console.log(`Migracija: ${file}`);
  }
  console.log(
    sql(
      readFileSync('tests/database.sql', 'utf8') +
        '\n' +
        readFileSync('tests/admin-tools.sql', 'utf8') +
        '\n' +
        readFileSync('tests/commerce.sql', 'utf8') +
        '\n' +
        readFileSync('tests/payment-methods.sql', 'utf8') +
        '\n' +
        readFileSync('tests/catalog-deletion.sql', 'utf8') +
        '\n' +
        readFileSync('tests/cart-checkout.sql', 'utf8') +
        '\n' +
        readFileSync('tests/bank-method.sql', 'utf8') +
        '\n' +
        readFileSync('tests/guest-checkout.sql', 'utf8') +
        '\n' +
        readFileSync('tests/category-slugs.sql', 'utf8'),
    ),
  );
  // Dva različita kupona izbjegavaju serijalizaciju samo na retku istog kupona.
  const concurrentOrder = (code) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        'docker',
        ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
        { stdio: ['pipe', 'ignore', 'pipe'] },
      );
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stderr }));
      child.stdin.end(
        `set role authenticated;select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',false);begin;select public.create_order((select id from public.services where slug='excel'),1,'Istodobna prva narudžba','Opis za provjeru istodobnog korištenja kupona',null,'full','${code}');select pg_sleep(0.3);commit;`,
      );
    });
  const concurrent = await Promise.all([concurrentOrder('FIRSTA'), concurrentOrder('FIRSTB')]);
  if (
    concurrent.filter((result) => result.code === 0).length !== 1 ||
    concurrent.filter(
      (result) =>
        result.code !== 0 && result.stderr.includes('Kupon vrijedi samo za prvu narudžbu'),
    ).length !== 1
  )
    throw new Error('Istodobni popusti za prvu narudžbu nisu serijalizirani.');
  console.log(
    sql(
      `do $$begin if(select count(*)from public.orders where user_id='77777777-7777-4777-8777-777777777777')<>1 then raise exception 'Više od jedne prve narudžbe';end if;raise notice 'PASS: Istodobne narudžbe s različitim kuponima dopuštaju samo jednu prvu narudžbu';end$$;`,
    ),
  );
  // Dva istodobna klika s istim zahtjevom ne smiju stvoriti dvije košarice/narudžbe.
  sql(
    `insert into auth.users(id)values('dddddddd-dddd-4ddd-8ddd-dddddddddddd');set role authenticated;select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);select public.cart_add((select id from public.services where slug='checkout-prvi'),1);`,
  );
  const checkoutCommand = `set role authenticated;select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);begin;select public.checkout_cart_order('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Istodobna košarica','Upute za istodobnu potvrdu košarice',now()+interval'2 day','bank','full','{"course":"Dokumenti"}',null);select pg_sleep(0.3);commit;`;
  const checkoutTwice = () =>
    new Promise((resolve, reject) => {
      const child = spawn(
        'docker',
        ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
        { stdio: ['pipe', 'ignore', 'pipe'] },
      );
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stderr }));
      child.stdin.end(checkoutCommand);
    });
  const checkoutResults = await Promise.all([checkoutTwice(), checkoutTwice()]);
  if (checkoutResults.some((r) => r.code !== 0))
    throw new Error(
      'Istodobna potvrda košarice nije idempotentna: ' +
        checkoutResults.map((r) => r.stderr).join('\n'),
    );
  console.log(
    sql(
      `do $$begin if(select count(*)from public.orders where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>1 then raise exception 'Duplicirana košarica';end if;raise notice 'PASS: Istodobna potvrda iste košarice stvara točno jednu narudžbu';end$$;`,
    ),
  );
  console.log(
    'PostgreSQL integracijske provjere su prošle. Auth i Storage sheme su minimalni testni adapteri, ne puni Supabase.',
  );
} finally {
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
}

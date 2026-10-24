import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const file = '202610240008_payment_methods.sql',
  source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: dodavanje i uklanjanje prikaza načina plaćanja.
-- Pokrenite cijelu datoteku jednom u Supabase SQL Editoru nakon nadogradnji 006 i 007.
-- Ne mijenja Stripe račun, postojeće narudžbe ili uplate. Apple Pay/Google Pay/KEKS se ne aktiviraju automatski.
BEGIN;
DO $fp_guard$BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'AND table_name='promo_codes'AND column_name='first_order_only')THEN RAISE EXCEPTION 'Prvo primijenite SQL nadogradnju 007.';END IF;
 IF to_regclass('public.payment_methods')IS NOT NULL THEN RAISE EXCEPTION 'Nadogradnja 008 već je primijenjena.';END IF;
END $fp_guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610240008','payment_methods',ARRAY[$fp_source$${source}$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Upravljanje prikazom načina plaćanja omogućeno.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-payment-methods-upgrade.mjs');
} else {
  mkdirSync('public/migracije', { recursive: true });
  writeFileSync(target, sql);
  console.log(`Pripremljeno: ${target}`);
}

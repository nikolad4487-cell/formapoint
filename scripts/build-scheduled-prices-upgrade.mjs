import { readFileSync, writeFileSync } from 'node:fs';
const file = '202611120020_scheduled_prices.sql',
  source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: planirane cijene i odobreni cjenik od 1.1.2027. Nakon nadogradnje 019.
BEGIN;
DO $guard$BEGIN IF to_regprocedure('public.save_service_packages(uuid,boolean,jsonb)')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 019.';END IF;END$guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202611120020','scheduled_prices',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT count(*) AS broj_zakazanih_cijena_za_2027 FROM public.service_price_schedules WHERE starts_at='2027-01-01 00:00:00 Europe/Zagreb'::timestamptz AND status='pending';
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-scheduled-prices-upgrade.mjs');
} else writeFileSync(target, sql);

import { readFileSync, writeFileSync } from 'node:fs';
const file = '202611120019_service_packages.sql',
  source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: više paketa po usluzi. Nakon nadogradnje 017.
BEGIN;
DO $guard$BEGIN IF to_regprocedure('public.cart_pricing_before_payment_rules(text)')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 017.';END IF;END$guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202611120019','service_packages',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Paketi su spremni. Otvorite Usluge i odaberite Paketi uz željenu uslugu.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-service-packages-upgrade.mjs');
} else writeFileSync(target, sql);

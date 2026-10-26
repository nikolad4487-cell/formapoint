import { readFileSync, writeFileSync } from 'node:fs';
const file = '202610260014_personal_promotions.sql',
  source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: personalizirane promocije, kodovi i evidencija e-mail isporuke. Pokrenite jednom nakon 012.
BEGIN;
DO $guard$BEGIN
 IF to_regprocedure('public.cart_pricing_before_guest(text)')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 012.';END IF;
 IF to_regclass('public.promotion_campaigns')IS NOT NULL THEN RAISE EXCEPTION 'Nadogradnja 014 već je primijenjena.';END IF;
END $guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610260014','personal_promotions',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Personalizirane promocije spremne. Objavite promotions i notify te provjerite Resend Secrets.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-promotions-upgrade.mjs');
} else writeFileSync(target, sql);

import { readFileSync, writeFileSync } from 'node:fs';
const file = '202610260016_birthday_promotions.sql',
  source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: automatske rođendanske promocije. Pokrenite nakon nadogradnje 015.
BEGIN;
DO $guard$BEGIN IF to_regprocedure('public.promotion_schedule_ready()')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 015.';END IF;END$guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610260016','birthday_promotions',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Rođendanske promocije spremne: dan i mjesec u profilu, automatsko slanje jednom godišnje.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-birthday-promotions-upgrade.mjs');
} else writeFileSync(target, sql);

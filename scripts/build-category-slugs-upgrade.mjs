import { readFileSync, writeFileSync } from 'node:fs';
const file = '202610260013_category_service_slugs.sql';
const source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: zasebni slugovi artikala po kategoriji. Pokrenite cijelu datoteku jednom.
BEGIN;
DO $guard$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.services'::regclass AND conname='services_slug_key') THEN RAISE EXCEPTION 'Nadogradnja 013 već je primijenjena ili nedostaje početna shema.';END IF;
END $guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610260013','category_service_slugs',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Slugovi artikala sada su jedinstveni unutar svake kategorije.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-category-slugs-upgrade.mjs');
} else writeFileSync(target, sql);

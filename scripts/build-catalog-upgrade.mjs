import { readFileSync, writeFileSync } from 'node:fs';
const file = '202610250009_catalog_deletion.sql';
const source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: brisanje svih artikala (početnih i naknadno dodanih).
-- Pokrenite cijelu datoteku jednom u Supabase SQL Editoru. Potrebne su osnovne migracije 001–005.
-- Ova nadogradnja samo dodaje mogućnost brisanja; sama ne briše artikle.
BEGIN;
DO $fp_guard$BEGIN
 IF to_regprocedure('public.sync_service_category()') IS NULL THEN RAISE EXCEPTION 'Prvo primijenite osnovne migracije 001–005.'; END IF;
 IF to_regprocedure('public.admin_delete_service(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Nadogradnja 009 već je primijenjena.'; END IF;
END $fp_guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610250009','catalog_deletion',ARRAY[$fp_source$${source}$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Brisanje artikala i praznih kategorija omogućeno.' AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-catalog-upgrade.mjs');
} else {
  writeFileSync(target, sql);
  console.log(`Pripremljeno: ${target}`);
}

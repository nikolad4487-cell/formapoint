import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const file = '202610240006_admin_tools.sql';
const migration = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: nadogradnja postojeće baze (migracije 001–005 moraju već postojati).
-- Otvorite Supabase SQL Editor, zalijepite cijelu datoteku i pokrenite jednom.
-- Čuva postojeće račune, uloge, narudžbe i uplate. Ne sadrži API ključeve ni lozinke.
BEGIN;
DO $fp_guard$
BEGIN
 IF to_regclass('public.orders') IS NULL OR to_regprocedure('public.sync_service_category()') IS NULL THEN
  RAISE EXCEPTION 'Nedostaje osnovna FormaPoint shema (migracije 001–005). Ova datoteka je samo nadogradnja.';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='site_settings' AND column_name='platform_name') THEN
  RAISE EXCEPTION 'Nadogradnja 202610240006 već je primijenjena. Nemojte je ponovno pokretati.';
 END IF;
END $fp_guard$;
${migration}
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610240006','admin_tools',ARRAY[$fp_source$${migration}$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'FormaPoint nadogradnja 202610240006 uspješno je primijenjena.' AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('SQL nadogradnja nije ažurna: pokrenite node scripts/build-admin-upgrade.mjs');
} else {
  mkdirSync('public/migracije', { recursive: true });
  writeFileSync(target, sql);
  console.log(`Pripremljeno: ${target}`);
}

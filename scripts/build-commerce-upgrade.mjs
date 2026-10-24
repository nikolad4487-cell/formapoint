import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const file = '202610240007_icons_first_order.sql',
  migration = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: učitavanje ikona plaćanja i popusti samo za prvu narudžbu.
-- U Supabase SQL Editoru pokrenite jednom, nakon nadogradnje 202610240006.
-- Postojeći kuponi zadržavaju svoja pravila. Korisnici i narudžbe se ne brišu.
BEGIN;
DO $fp_guard$BEGIN
 IF to_regclass('public.newsletter_templates')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 202610240006_admin_tools.sql.';END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'AND table_name='promo_codes'AND column_name='first_order_only')THEN RAISE EXCEPTION 'Nadogradnja 202610240007 već je primijenjena.';END IF;
END $fp_guard$;
${migration}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610240007','icons_first_order',ARRAY[$fp_source$${migration}$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Ikone i popusti za nove korisnike uspješno su omogućeni.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-commerce-upgrade.mjs');
} else {
  mkdirSync('public/migracije', { recursive: true });
  writeFileSync(target, sql);
  console.log(`Pripremljeno: ${target}`);
}

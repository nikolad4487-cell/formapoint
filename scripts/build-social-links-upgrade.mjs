import { readFileSync, writeFileSync } from 'node:fs';
const file = '202611120018_social_links.sql',
  source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: Facebook, Instagram i WhatsApp zajednica. Nakon nadogradnje 006.
BEGIN;
DO $guard$BEGIN IF not exists(select 1 from information_schema.columns where table_schema='public'and table_name='site_settings'and column_name='facebook_url') THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 006.';END IF;END$guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202611120018','social_links',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Poveznica WhatsApp zajednice može se spremiti u Opće postavke.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-social-links-upgrade.mjs');
} else writeFileSync(target, sql);

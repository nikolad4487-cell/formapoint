import { readFileSync, writeFileSync } from 'node:fs';
const file = '202610260015_scheduled_promotions.sql',
  source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: slanje osobnih kodova na početku valjanosti. Pokrenite nakon nadogradnje 014.
BEGIN;
DO $guard$BEGIN IF to_regclass('public.promotion_campaigns')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 014.';END IF;END$guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610260015','scheduled_promotions',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Promotivni e-mailovi šalju se od početnog datuma i vremena valjanosti.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-scheduled-promotions-upgrade.mjs');
} else writeFileSync(target, sql);

import { readFileSync, writeFileSync } from 'node:fs';
const file = '202611100017_coupon_payment_rules.sql',
  source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: POPUST10 samo uz jednokratno kartično plaćanje. Nakon nadogradnje 014.
BEGIN;
DO $guard$BEGIN IF to_regclass('public.promotion_campaigns')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 014.';END IF;END$guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202611100017','coupon_payment_rules',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'POPUST10 vrijedi samo za prvu narudžbu uz jednokratno kartično plaćanje.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-coupon-payment-upgrade.mjs');
} else writeFileSync(target, sql);

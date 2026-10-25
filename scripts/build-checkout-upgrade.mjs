import { readFileSync, writeFileSync } from 'node:fs';
const file = '202610250010_cart_checkout.sql';
const source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: košarica → podaci → odabir plaćanja; IBAN i Stripe.
-- Pokrenite cijelu datoteku jednom nakon nadogradnji 006–009.
-- Ne kreira narudžbe, ne potvrđuje uplate i ne uključuje IBAN automatski.
BEGIN;
DO $fp_guard$BEGIN
 IF to_regprocedure('public.admin_delete_service(uuid)')IS NULL OR to_regclass('public.payment_methods')IS NULL OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'AND table_name='promo_codes'AND column_name='first_order_only')THEN RAISE EXCEPTION 'Prvo primijenite nadogradnje 006–009.';END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'AND table_name='orders'AND column_name='payment_method')THEN RAISE EXCEPTION 'Nadogradnja 010 već je primijenjena.';END IF;
END $fp_guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610250010','cart_checkout',ARRAY[$fp_source$${source}$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Košarica i IBAN plaćanja su spremni. IBAN uključite u administratorskim postavkama.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-checkout-upgrade.mjs');
} else {
  writeFileSync(target, sql);
  console.log(`Pripremljeno: ${target}`);
}

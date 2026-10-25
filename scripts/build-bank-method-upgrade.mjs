import { readFileSync, writeFileSync } from 'node:fs';
const file = '202610250011_bank_method.sql';
const source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- FormaPoint: povezivanje IBAN kartice s bankovnom uplatom. Čuva postojeće ikone i uplate.
-- Pokrenite cijelu datoteku jednom nakon nadogradnje 010.
BEGIN;
DO $fp_guard$BEGIN
 IF to_regprocedure('public.checkout_cart_order(uuid,text,text,timestamp with time zone,text,text,jsonb,text)')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 010.';END IF;
 IF to_regprocedure('public.configure_bank_method(boolean)')IS NOT NULL THEN RAISE EXCEPTION 'Nadogradnja 011 već je primijenjena.';END IF;
END $fp_guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610250011','bank_method',ARRAY[$fp_source$${source}$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'IBAN kartica povezana je s postavkama bankovne uplate. Postojeće ikone su sačuvane.'AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-bank-method-upgrade.mjs');
} else {
  writeFileSync(target, sql);
  console.log(`Pripremljeno: ${target}`);
}

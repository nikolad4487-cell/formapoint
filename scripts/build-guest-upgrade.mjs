import { readFileSync, writeFileSync } from 'node:fs';
const file = '202610260012_guest_checkout.sql';
const source = readFileSync(`supabase/migrations/${file}`, 'utf8');
const sql = `-- Pokrenite cijelu datoteku jednom nakon nadogradnje 011.
BEGIN;
DO $guard$BEGIN
 IF to_regprocedure('public.configure_bank_method(boolean)') IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 011.';END IF;
 IF to_regprocedure('public.save_guest_contact(text,text,text,boolean)') IS NOT NULL THEN RAISE EXCEPTION 'Nadogradnja 012 već je primijenjena.';END IF;
END $guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610260012','guest_checkout',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Kupnja kao gost spremna. U Auth postavkama uključite Anonymous Sign-Ins, isključite Confirm email i postavite minimalnu lozinku na 8.' AS rezultat;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-guest-upgrade.mjs');
} else writeFileSync(target, sql);

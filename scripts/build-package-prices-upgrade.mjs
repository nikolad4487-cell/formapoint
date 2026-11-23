import { readFileSync, writeFileSync } from 'node:fs';
import { packagePlans2027 } from '../seo/package-prices-2027.mjs';
const file = '202611230021_scheduled_package_prices.sql';
const sourcePath = `supabase/migrations/${file}`;
const original = readFileSync(sourcePath, 'utf8');
const values = packagePlans2027
  .map((plan) => `('${plan.service_id}'::uuid,$plan$${JSON.stringify(plan.packages)}$plan$::jsonb)`)
  .join(',\n');
const seed = `-- BEGIN APPROVED PACKAGE PLANS
DO $seed_packages$DECLARE r record;BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='202611230021')THEN RETURN;END IF;
 FOR r IN SELECT * FROM(VALUES\n${values}\n)v(service_id,packages)LOOP
  IF NOT EXISTS(SELECT 1 FROM public.services WHERE id=r.service_id)THEN RAISE EXCEPTION 'Nedostaje usluga za odobreni cjenik paketa: %',r.service_id;END IF;
  INSERT INTO public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note,package_plan)
  SELECT s.id,s.name,s.category,(SELECT min((p->>'price_cents')::integer)FROM jsonb_array_elements(r.packages)p),'2027-01-01 00:00:00 Europe/Zagreb'::timestamptz,'Odobreni cjenik paketa od 1.1.2027.',r.packages FROM public.services s WHERE s.id=r.service_id
  ON CONFLICT(service_id,starts_at)DO UPDATE SET package_plan=excluded.package_plan,new_price_cents=excluded.new_price_cents,note=excluded.note WHERE service_price_schedules.status='pending';
 END LOOP;
END$seed_packages$;
-- END APPROVED PACKAGE PLANS`;
const source = original.replace(
  /-- BEGIN APPROVED PACKAGE PLANS[\s\S]*?-- END APPROVED PACKAGE PLANS/,
  () => seed,
);
const sql = `-- FormaPoint 021: pet paketa od 1.1.2027. Primijeniti nakon nadogradnje 020.\nBEGIN;
DO $guard$BEGIN IF to_regclass('public.service_price_schedules')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 020.';END IF;END$guard$;
${source}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202611230021','scheduled_package_prices',ARRAY[$source$${source}$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT service_name,starts_at,status,jsonb_array_length(package_plan)AS broj_paketa FROM public.service_price_schedules WHERE package_plan IS NOT NULL ORDER BY service_name;
`;
const target = `public/migracije/${file}`;
if (process.argv.includes('--check')) {
  if (original !== source || readFileSync(target, 'utf8') !== sql)
    throw new Error('Pokrenite node scripts/build-package-prices-upgrade.mjs');
} else {
  writeFileSync(sourcePath, source);
  writeFileSync(target, sql);
}

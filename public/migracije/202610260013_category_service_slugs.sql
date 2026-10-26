-- FormaPoint: zasebni slugovi artikala po kategoriji. Pokrenite cijelu datoteku jednom.
BEGIN;
DO $guard$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.services'::regclass AND conname='services_slug_key') THEN RAISE EXCEPTION 'Nadogradnja 013 već je primijenjena ili nedostaje početna shema.';END IF;
END $guard$;
-- Slug artikla jedinstven je unutar kategorije; ID-evi, narudžbe i cijene ostaju isti.
alter table public.services drop constraint services_slug_key;
alter table public.services alter column category_id set not null;
alter table public.services add constraint services_category_slug_key unique(category_id,slug);
alter table public.service_categories add constraint category_public_slug_check
 check(slug ~ '^[a-z0-9-]+$' and slug not in('app','admin','p','usluge'));

INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610260013','category_service_slugs',ARRAY[$source$-- Slug artikla jedinstven je unutar kategorije; ID-evi, narudžbe i cijene ostaju isti.
alter table public.services drop constraint services_slug_key;
alter table public.services alter column category_id set not null;
alter table public.services add constraint services_category_slug_key unique(category_id,slug);
alter table public.service_categories add constraint category_public_slug_check
 check(slug ~ '^[a-z0-9-]+$' and slug not in('app','admin','p','usluge'));
$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Slugovi artikala sada su jedinstveni unutar svake kategorije.'AS rezultat;

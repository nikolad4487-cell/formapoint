-- Slug artikla jedinstven je unutar kategorije; ID-evi, narudžbe i cijene ostaju isti.
alter table public.services drop constraint services_slug_key;
alter table public.services alter column category_id set not null;
alter table public.services add constraint services_category_slug_key unique(category_id,slug);
alter table public.service_categories add constraint category_public_slug_check
 check(slug ~ '^[a-z0-9-]+$' and slug not in('app','admin','p','usluge'));

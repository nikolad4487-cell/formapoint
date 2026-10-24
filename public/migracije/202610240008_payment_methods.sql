-- FormaPoint: dodavanje i uklanjanje prikaza načina plaćanja.
-- Pokrenite cijelu datoteku jednom u Supabase SQL Editoru nakon nadogradnji 006 i 007.
-- Ne mijenja Stripe račun, postojeće narudžbe ili uplate. Apple Pay/Google Pay/KEKS se ne aktiviraju automatski.
BEGIN;
DO $fp_guard$BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'AND table_name='promo_codes'AND column_name='first_order_only')THEN RAISE EXCEPTION 'Prvo primijenite SQL nadogradnju 007.';END IF;
 IF to_regclass('public.payment_methods')IS NOT NULL THEN RAISE EXCEPTION 'Nadogradnja 008 već je primijenjena.';END IF;
END $fp_guard$;
-- Upravljanje prikazom plaćanja. Stvarna naplata ostaje kod povezanog pružatelja.
create table public.payment_methods(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[a-z][a-z0-9_]{1,49}$'),
 name text not null check(length(trim(name))between 2 and 80),
 provider text not null check(provider in('stripe','unconnected')),
 enabled boolean not null default false,
 verified boolean not null default false,
 icon_url text check(icon_url is null or(length(icon_url)<=2000 and icon_url ~ '^https://[^[:space:]]+$')),
 created_at timestamptz not null default now(),
 check((provider='stripe'and code in('visa','mastercard','apple_pay','google_pay'))or(provider='unconnected'and not enabled)),
 check(not enabled or code in('visa','mastercard')or verified)
);
alter table public.payment_methods enable row level security;
create policy payment_methods_admin on public.payment_methods for all to authenticated using(public.is_admin())with check(public.is_admin());
create policy payment_methods_public on public.payment_methods for select to anon,authenticated using(enabled and provider='stripe'and(code in('visa','mastercard')or verified));
revoke all on public.payment_methods from anon,authenticated;
grant select on public.payment_methods to anon;
grant select,insert,update,delete on public.payment_methods to authenticated;
grant all on public.payment_methods to service_role;
create trigger audit_row after insert or update or delete on public.payment_methods for each row execute function public.audit_change();
-- Novčanici i nepovezani pružatelji se ne uključuju automatski iz starih ikona.
insert into public.payment_methods(code,name,provider,enabled,verified,icon_url)
 select method.code,method.name,'stripe',true,true,nullif(s.payment_icons->>method.code,'')
 from public.site_settings s cross join(values('visa','Visa'),('mastercard','Mastercard'))as method(code,name)where s.id=true;
-- Vlastita metoda može imati ikonu i dok je u pripremi. To ne aktivira naplatu.
drop policy payment_icons_admin_insert on storage.objects;
create policy payment_icons_admin_insert on storage.objects for insert to authenticated
 with check(bucket_id='payment-icons'and public.is_admin()and name ~ '^[a-z][a-z0-9_]{1,49}/[a-f0-9-]{36}\.png$');
NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610240008','payment_methods',ARRAY[$fp_source$-- Upravljanje prikazom plaćanja. Stvarna naplata ostaje kod povezanog pružatelja.
create table public.payment_methods(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[a-z][a-z0-9_]{1,49}$'),
 name text not null check(length(trim(name))between 2 and 80),
 provider text not null check(provider in('stripe','unconnected')),
 enabled boolean not null default false,
 verified boolean not null default false,
 icon_url text check(icon_url is null or(length(icon_url)<=2000 and icon_url ~ '^https://[^[:space:]]+$')),
 created_at timestamptz not null default now(),
 check((provider='stripe'and code in('visa','mastercard','apple_pay','google_pay'))or(provider='unconnected'and not enabled)),
 check(not enabled or code in('visa','mastercard')or verified)
);
alter table public.payment_methods enable row level security;
create policy payment_methods_admin on public.payment_methods for all to authenticated using(public.is_admin())with check(public.is_admin());
create policy payment_methods_public on public.payment_methods for select to anon,authenticated using(enabled and provider='stripe'and(code in('visa','mastercard')or verified));
revoke all on public.payment_methods from anon,authenticated;
grant select on public.payment_methods to anon;
grant select,insert,update,delete on public.payment_methods to authenticated;
grant all on public.payment_methods to service_role;
create trigger audit_row after insert or update or delete on public.payment_methods for each row execute function public.audit_change();
-- Novčanici i nepovezani pružatelji se ne uključuju automatski iz starih ikona.
insert into public.payment_methods(code,name,provider,enabled,verified,icon_url)
 select method.code,method.name,'stripe',true,true,nullif(s.payment_icons->>method.code,'')
 from public.site_settings s cross join(values('visa','Visa'),('mastercard','Mastercard'))as method(code,name)where s.id=true;
-- Vlastita metoda može imati ikonu i dok je u pripremi. To ne aktivira naplatu.
drop policy payment_icons_admin_insert on storage.objects;
create policy payment_icons_admin_insert on storage.objects for insert to authenticated
 with check(bucket_id='payment-icons'and public.is_admin()and name ~ '^[a-z][a-z0-9_]{1,49}/[a-f0-9-]{36}\.png$');
NOTIFY pgrst, 'reload schema';
$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Upravljanje prikazom načina plaćanja omogućeno.'AS rezultat;

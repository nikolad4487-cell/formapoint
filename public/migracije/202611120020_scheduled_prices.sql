-- FormaPoint: planirane cijene i odobreni cjenik od 1.1.2027. Nakon nadogradnje 019.
BEGIN;
DO $guard$BEGIN IF to_regprocedure('public.save_service_packages(uuid,boolean,jsonb)')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 019.';END IF;END$guard$;
-- Planirana promjena osnovnih cijena, bez promjene postojećih narudžbi i paketa.
create table if not exists public.service_price_schedules(
 id uuid primary key default gen_random_uuid(),service_id uuid references public.services on delete set null,
 service_name text not null,category_name text not null,new_price_cents integer not null check(new_price_cents between 100 and 100000000),
 starts_at timestamptz not null,status text not null default 'pending' check(status in('pending','applied','cancelled','skipped')),
 note text not null default '',created_by uuid references auth.users,created_at timestamptz not null default now(),
 applied_at timestamptz,old_price_cents integer,last_error text,unique(service_id,starts_at)
);
create index if not exists due_service_prices on public.service_price_schedules(starts_at)where status='pending';
alter table public.service_price_schedules enable row level security;
revoke all on public.service_price_schedules from public,anon,authenticated;
grant select on public.service_price_schedules to authenticated;
grant all on public.service_price_schedules to service_role;
drop policy if exists admin_read on public.service_price_schedules;
create policy admin_read on public.service_price_schedules for select to authenticated using(public.is_admin());

create or replace function public.apply_due_service_prices()returns integer language plpgsql security definer set search_path=public as $$
declare r public.service_price_schedules;s public.services;n integer:=0;begin
 if not exists(select 1 from public.service_price_schedules where status='pending'and starts_at<=now())then return 0;end if;
 perform pg_advisory_xact_lock(hashtextextended('scheduled-service-prices',0));
 for r in select * from public.service_price_schedules where status='pending'and starts_at<=now()order by starts_at,id for update loop
  select * into s from public.services where id=r.service_id for update;
  if not found or s.packages_enabled then
   update public.service_price_schedules set status='skipped',last_error=case when s.id is null then'Usluga je izbrisana.'else'Usluga koristi pakete. Provjerite cijene paketa.'end where id=r.id;
   continue;
  end if;
  update public.services set price_cents=r.new_price_cents where id=s.id;
  update public.service_price_schedules set status='applied',applied_at=now(),old_price_cents=s.price_cents,last_error=null where id=r.id;
  insert into public.audit_logs(actor_id,action,entity_id,details)values(r.created_by,'service.scheduled_price_applied',s.id::text,jsonb_build_object('schedule_id',r.id,'starts_at',r.starts_at,'old_cents',s.price_cents,'new_cents',r.new_price_cents));
  n:=n+1;
 end loop;return n;
end$$;
revoke all on function public.apply_due_service_prices()from public,anon,authenticated;
grant execute on function public.apply_due_service_prices()to service_role;
-- Posjetitelj može samo primijeniti već odobrene promjene kojima je nastupio rok.
-- Nema parametara za cijenu ili datum, a sat određuje baza.
create or replace function public.refresh_service_prices()returns integer language sql security definer set search_path=public as $$select public.apply_due_service_prices()$$;
revoke all on function public.refresh_service_prices()from public;
grant execute on function public.refresh_service_prices()to anon,authenticated,service_role;

create or replace function public.schedule_service_price(p_service uuid,p_price integer,p_starts timestamptz,p_note text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare s public.services;sid uuid;actor uuid:=public.assert_user();begin
 perform public.assert_admin();
 if p_price is null or p_price not between 100 and 100000000 or p_starts is null or p_starts<=now()or length(coalesce(p_note,''))>1000 then raise exception 'Unesite cijenu od najmanje 1 EUR i budući datum početka';end if;
 select * into s from public.services where id=p_service for share;
 if not found or s.packages_enabled then raise exception 'Odaberite uslugu bez paketa. Cijene paketa uređuju se zasebno.';end if;
 insert into public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note,created_by)
 values(s.id,s.name,s.category,p_price,p_starts,coalesce(p_note,''),actor)
 on conflict(service_id,starts_at)do update set new_price_cents=excluded.new_price_cents,note=excluded.note,created_by=actor,status='pending',last_error=null
 where service_price_schedules.status<>'applied' returning id into sid;
 if sid is null then raise exception 'Ta promjena već je primijenjena';end if;
 insert into public.audit_logs(actor_id,action,entity_id,details)values(actor,'service.price_scheduled',s.id::text,jsonb_build_object('schedule_id',sid,'starts_at',p_starts,'new_cents',p_price));
 return sid;
end$$;
create or replace function public.cancel_service_price(p_id uuid)returns void language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();
 update public.service_price_schedules set status='cancelled'where id=p_id and status='pending';
 if not found then raise exception 'Promjena više nije na čekanju';end if;
 insert into public.audit_logs(actor_id,action,entity_id)values(auth.uid(),'service.scheduled_price_cancelled',p_id::text);
end$$;
revoke all on function public.schedule_service_price(uuid,integer,timestamptz,text),public.cancel_service_price(uuid)from public,anon;
grant execute on function public.schedule_service_price(uuid,integer,timestamptz,text),public.cancel_service_price(uuid)to authenticated;

create or replace function public.price_schedule_health()returns jsonb language plpgsql security definer set search_path=public as $$
declare ready boolean:=false;begin
 perform public.assert_admin();
 if to_regclass('cron.job')is not null then execute 'select exists(select 1 from cron.job where jobname=''formapoint-scheduled-prices''and active)'into ready;end if;
 return jsonb_build_object('worker_ready',ready,'changes',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb)from(select * from public.service_price_schedules order by starts_at desc,created_at desc limit 200)r));
end$$;
revoke all on function public.price_schedule_health()from public,anon;
grant execute on function public.price_schedule_health()to authenticated;

-- Najprije primijeni rokove, prije zaključavanja košarice i artikala.
do $$begin
 if to_regprocedure('public.cart_pricing_before_scheduled_prices(text)')is null then alter function public.cart_pricing(text)rename to cart_pricing_before_scheduled_prices;end if;
 if to_regprocedure('public.checkout_cart_order_before_scheduled_prices(uuid,text,text,timestamptz,text,text,jsonb,text)')is null then alter function public.checkout_cart_order(uuid,text,text,timestamptz,text,text,jsonb,text)rename to checkout_cart_order_before_scheduled_prices;end if;
 if to_regprocedure('public.create_order_before_scheduled_prices(uuid,integer,text,text,timestamptz,text,text)')is null then alter function public.create_order(uuid,integer,text,text,timestamptz,text,text)rename to create_order_before_scheduled_prices;end if;
end$$;
revoke all on function public.cart_pricing_before_scheduled_prices(text),public.checkout_cart_order_before_scheduled_prices(uuid,text,text,timestamptz,text,text,jsonb,text),public.create_order_before_scheduled_prices(uuid,integer,text,text,timestamptz,text,text)from public,anon,authenticated;
create or replace function public.cart_pricing(p_promo text default null)returns jsonb language plpgsql security definer set search_path=public as $$declare n integer;begin
 perform public.assert_user();n:=public.apply_due_service_prices();
 return public.cart_pricing_before_scheduled_prices(p_promo)||jsonb_build_object('applied_price_changes',n);
end$$;
create or replace function public.checkout_cart_order(p_request uuid,p_title text,p_description text,p_due timestamptz,p_method text,p_model text,p_details jsonb default '{}',p_promo text default null)returns uuid language plpgsql security definer set search_path=public as $$begin
 perform public.assert_user();perform public.apply_due_service_prices();
 return public.checkout_cart_order_before_scheduled_prices(p_request,p_title,p_description,p_due,p_method,p_model,p_details,p_promo);
end$$;
create or replace function public.create_order(p_service uuid,p_quantity integer,p_title text,p_description text,p_due timestamptz default null,p_model text default 'full',p_promo text default null)returns uuid language plpgsql security definer set search_path=public as $$begin
 perform public.assert_user();perform public.apply_due_service_prices();
 return public.create_order_before_scheduled_prices(p_service,p_quantity,p_title,p_description,p_due,p_model,p_promo);
end$$;
revoke all on function public.cart_pricing(text),public.checkout_cart_order(uuid,text,text,timestamptz,text,text,jsonb,text),public.create_order(uuid,integer,text,text,timestamptz,text,text)from public,anon;
grant execute on function public.cart_pricing(text),public.checkout_cart_order(uuid,text,text,timestamptz,text,text,jsonb,text),public.create_order(uuid,integer,text,text,timestamptz,text,text)to authenticated;

-- Pozadinski posao ne ovisi o pregledniku, e-pošti ili Edge ključevima.
do $price_worker$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron')then
  begin
   create extension if not exists pg_cron;
   execute $job$select cron.schedule('formapoint-scheduled-prices','* * * * *','select public.apply_due_service_prices();')$job$;
  exception when others then raise notice 'Pozadinski posao cijena nije aktivan. Rokovi se provjeravaju i pri otvaranju kataloga i naplati.';end;
 end if;
end$price_worker$;
NOTIFY pgrst,'reload schema';

-- Odobreni cjenik vlasnika. Točan lokalni trenutak: 1.1.2027. 00:00 Hrvatska.
DO $seed_2027$DECLARE r record;v_service uuid;v_category uuid;v_at timestamptz:='2027-01-01 00:00:00 Europe/Zagreb';BEGIN
 -- Ponovna objava migracije ne vraća namjerno izbrisane nacrte ili rasporede.
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='202611120020')THEN RETURN;END IF;
 FOR r IN SELECT * FROM(VALUES
 ('95d76eb9-11a1-4ab0-a1a7-a5cb133dc002'::uuid,8000),
 ('e5bd9877-b653-4aaa-9b1d-9050a057db5f'::uuid,3000),
 ('ee882470-25af-4711-85b9-1ad9070d84fa'::uuid,3000),
 ('bcfb0551-2dcc-4078-9fac-03e318bed22d'::uuid,2000),
 ('aa8920d3-5901-4b01-9cf0-f77dcaeb1486'::uuid,2000),
 ('2fe7aa46-f1a2-4a1d-9b93-a0117c5d1d23'::uuid,2000),
 ('7c96d11f-f001-4597-8f1b-d0982c77493e'::uuid,2000),
 ('07350119-2724-463d-b241-40f674caccf0'::uuid,2000),
 ('19223dab-a88d-4c35-a9a4-2bd1976bf3a2'::uuid,2000)
 )v(service_id,price)LOOP
  INSERT INTO public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note)
  SELECT s.id,s.name,s.category,r.price,v_at,'Cjenik od 1.1.2027. — odobreno od vlasnika'FROM public.services s WHERE s.id=r.service_id
  ON CONFLICT(service_id,starts_at)DO NOTHING;
 END LOOP;
 -- Seminar je nov: ostaje nacrt dok vlasnik ne dovrši opis i ne objavi uslugu.
 SELECT id INTO v_category FROM public.service_categories WHERE name='Učenički radovi - osnovna i srednja škola';
 IF v_category IS NOT NULL THEN
  SELECT id INTO v_service FROM public.services WHERE category_id=v_category AND slug='seminar';
  IF v_service IS NULL THEN
   INSERT INTO public.services(name,slug,description,category,price_cents,active)
   VALUES('Seminar','seminar','Seminar — opseg usluge i rok prema dogovoru.','Učenički radovi - osnovna i srednja škola',NULL,false)RETURNING id INTO v_service;
  END IF;
  INSERT INTO public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note)
  SELECT id,name,category,3000,v_at,'Novi seminar — cjenik od 1.1.2027.; objava usluge ostaje ručna'FROM public.services WHERE id=v_service
  ON CONFLICT(service_id,starts_at)DO NOTHING;
 END IF;
END$seed_2027$;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202611120020','scheduled_prices',ARRAY[$source$-- Planirana promjena osnovnih cijena, bez promjene postojećih narudžbi i paketa.
create table if not exists public.service_price_schedules(
 id uuid primary key default gen_random_uuid(),service_id uuid references public.services on delete set null,
 service_name text not null,category_name text not null,new_price_cents integer not null check(new_price_cents between 100 and 100000000),
 starts_at timestamptz not null,status text not null default 'pending' check(status in('pending','applied','cancelled','skipped')),
 note text not null default '',created_by uuid references auth.users,created_at timestamptz not null default now(),
 applied_at timestamptz,old_price_cents integer,last_error text,unique(service_id,starts_at)
);
create index if not exists due_service_prices on public.service_price_schedules(starts_at)where status='pending';
alter table public.service_price_schedules enable row level security;
revoke all on public.service_price_schedules from public,anon,authenticated;
grant select on public.service_price_schedules to authenticated;
grant all on public.service_price_schedules to service_role;
drop policy if exists admin_read on public.service_price_schedules;
create policy admin_read on public.service_price_schedules for select to authenticated using(public.is_admin());

create or replace function public.apply_due_service_prices()returns integer language plpgsql security definer set search_path=public as $$
declare r public.service_price_schedules;s public.services;n integer:=0;begin
 if not exists(select 1 from public.service_price_schedules where status='pending'and starts_at<=now())then return 0;end if;
 perform pg_advisory_xact_lock(hashtextextended('scheduled-service-prices',0));
 for r in select * from public.service_price_schedules where status='pending'and starts_at<=now()order by starts_at,id for update loop
  select * into s from public.services where id=r.service_id for update;
  if not found or s.packages_enabled then
   update public.service_price_schedules set status='skipped',last_error=case when s.id is null then'Usluga je izbrisana.'else'Usluga koristi pakete. Provjerite cijene paketa.'end where id=r.id;
   continue;
  end if;
  update public.services set price_cents=r.new_price_cents where id=s.id;
  update public.service_price_schedules set status='applied',applied_at=now(),old_price_cents=s.price_cents,last_error=null where id=r.id;
  insert into public.audit_logs(actor_id,action,entity_id,details)values(r.created_by,'service.scheduled_price_applied',s.id::text,jsonb_build_object('schedule_id',r.id,'starts_at',r.starts_at,'old_cents',s.price_cents,'new_cents',r.new_price_cents));
  n:=n+1;
 end loop;return n;
end$$;
revoke all on function public.apply_due_service_prices()from public,anon,authenticated;
grant execute on function public.apply_due_service_prices()to service_role;
-- Posjetitelj može samo primijeniti već odobrene promjene kojima je nastupio rok.
-- Nema parametara za cijenu ili datum, a sat određuje baza.
create or replace function public.refresh_service_prices()returns integer language sql security definer set search_path=public as $$select public.apply_due_service_prices()$$;
revoke all on function public.refresh_service_prices()from public;
grant execute on function public.refresh_service_prices()to anon,authenticated,service_role;

create or replace function public.schedule_service_price(p_service uuid,p_price integer,p_starts timestamptz,p_note text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare s public.services;sid uuid;actor uuid:=public.assert_user();begin
 perform public.assert_admin();
 if p_price is null or p_price not between 100 and 100000000 or p_starts is null or p_starts<=now()or length(coalesce(p_note,''))>1000 then raise exception 'Unesite cijenu od najmanje 1 EUR i budući datum početka';end if;
 select * into s from public.services where id=p_service for share;
 if not found or s.packages_enabled then raise exception 'Odaberite uslugu bez paketa. Cijene paketa uređuju se zasebno.';end if;
 insert into public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note,created_by)
 values(s.id,s.name,s.category,p_price,p_starts,coalesce(p_note,''),actor)
 on conflict(service_id,starts_at)do update set new_price_cents=excluded.new_price_cents,note=excluded.note,created_by=actor,status='pending',last_error=null
 where service_price_schedules.status<>'applied' returning id into sid;
 if sid is null then raise exception 'Ta promjena već je primijenjena';end if;
 insert into public.audit_logs(actor_id,action,entity_id,details)values(actor,'service.price_scheduled',s.id::text,jsonb_build_object('schedule_id',sid,'starts_at',p_starts,'new_cents',p_price));
 return sid;
end$$;
create or replace function public.cancel_service_price(p_id uuid)returns void language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();
 update public.service_price_schedules set status='cancelled'where id=p_id and status='pending';
 if not found then raise exception 'Promjena više nije na čekanju';end if;
 insert into public.audit_logs(actor_id,action,entity_id)values(auth.uid(),'service.scheduled_price_cancelled',p_id::text);
end$$;
revoke all on function public.schedule_service_price(uuid,integer,timestamptz,text),public.cancel_service_price(uuid)from public,anon;
grant execute on function public.schedule_service_price(uuid,integer,timestamptz,text),public.cancel_service_price(uuid)to authenticated;

create or replace function public.price_schedule_health()returns jsonb language plpgsql security definer set search_path=public as $$
declare ready boolean:=false;begin
 perform public.assert_admin();
 if to_regclass('cron.job')is not null then execute 'select exists(select 1 from cron.job where jobname=''formapoint-scheduled-prices''and active)'into ready;end if;
 return jsonb_build_object('worker_ready',ready,'changes',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb)from(select * from public.service_price_schedules order by starts_at desc,created_at desc limit 200)r));
end$$;
revoke all on function public.price_schedule_health()from public,anon;
grant execute on function public.price_schedule_health()to authenticated;

-- Najprije primijeni rokove, prije zaključavanja košarice i artikala.
do $$begin
 if to_regprocedure('public.cart_pricing_before_scheduled_prices(text)')is null then alter function public.cart_pricing(text)rename to cart_pricing_before_scheduled_prices;end if;
 if to_regprocedure('public.checkout_cart_order_before_scheduled_prices(uuid,text,text,timestamptz,text,text,jsonb,text)')is null then alter function public.checkout_cart_order(uuid,text,text,timestamptz,text,text,jsonb,text)rename to checkout_cart_order_before_scheduled_prices;end if;
 if to_regprocedure('public.create_order_before_scheduled_prices(uuid,integer,text,text,timestamptz,text,text)')is null then alter function public.create_order(uuid,integer,text,text,timestamptz,text,text)rename to create_order_before_scheduled_prices;end if;
end$$;
revoke all on function public.cart_pricing_before_scheduled_prices(text),public.checkout_cart_order_before_scheduled_prices(uuid,text,text,timestamptz,text,text,jsonb,text),public.create_order_before_scheduled_prices(uuid,integer,text,text,timestamptz,text,text)from public,anon,authenticated;
create or replace function public.cart_pricing(p_promo text default null)returns jsonb language plpgsql security definer set search_path=public as $$declare n integer;begin
 perform public.assert_user();n:=public.apply_due_service_prices();
 return public.cart_pricing_before_scheduled_prices(p_promo)||jsonb_build_object('applied_price_changes',n);
end$$;
create or replace function public.checkout_cart_order(p_request uuid,p_title text,p_description text,p_due timestamptz,p_method text,p_model text,p_details jsonb default '{}',p_promo text default null)returns uuid language plpgsql security definer set search_path=public as $$begin
 perform public.assert_user();perform public.apply_due_service_prices();
 return public.checkout_cart_order_before_scheduled_prices(p_request,p_title,p_description,p_due,p_method,p_model,p_details,p_promo);
end$$;
create or replace function public.create_order(p_service uuid,p_quantity integer,p_title text,p_description text,p_due timestamptz default null,p_model text default 'full',p_promo text default null)returns uuid language plpgsql security definer set search_path=public as $$begin
 perform public.assert_user();perform public.apply_due_service_prices();
 return public.create_order_before_scheduled_prices(p_service,p_quantity,p_title,p_description,p_due,p_model,p_promo);
end$$;
revoke all on function public.cart_pricing(text),public.checkout_cart_order(uuid,text,text,timestamptz,text,text,jsonb,text),public.create_order(uuid,integer,text,text,timestamptz,text,text)from public,anon;
grant execute on function public.cart_pricing(text),public.checkout_cart_order(uuid,text,text,timestamptz,text,text,jsonb,text),public.create_order(uuid,integer,text,text,timestamptz,text,text)to authenticated;

-- Pozadinski posao ne ovisi o pregledniku, e-pošti ili Edge ključevima.
do $price_worker$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron')then
  begin
   create extension if not exists pg_cron;
   execute $job$select cron.schedule('formapoint-scheduled-prices','* * * * *','select public.apply_due_service_prices();')$job$;
  exception when others then raise notice 'Pozadinski posao cijena nije aktivan. Rokovi se provjeravaju i pri otvaranju kataloga i naplati.';end;
 end if;
end$price_worker$;
NOTIFY pgrst,'reload schema';

-- Odobreni cjenik vlasnika. Točan lokalni trenutak: 1.1.2027. 00:00 Hrvatska.
DO $seed_2027$DECLARE r record;v_service uuid;v_category uuid;v_at timestamptz:='2027-01-01 00:00:00 Europe/Zagreb';BEGIN
 -- Ponovna objava migracije ne vraća namjerno izbrisane nacrte ili rasporede.
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='202611120020')THEN RETURN;END IF;
 FOR r IN SELECT * FROM(VALUES
 ('95d76eb9-11a1-4ab0-a1a7-a5cb133dc002'::uuid,8000),
 ('e5bd9877-b653-4aaa-9b1d-9050a057db5f'::uuid,3000),
 ('ee882470-25af-4711-85b9-1ad9070d84fa'::uuid,3000),
 ('bcfb0551-2dcc-4078-9fac-03e318bed22d'::uuid,2000),
 ('aa8920d3-5901-4b01-9cf0-f77dcaeb1486'::uuid,2000),
 ('2fe7aa46-f1a2-4a1d-9b93-a0117c5d1d23'::uuid,2000),
 ('7c96d11f-f001-4597-8f1b-d0982c77493e'::uuid,2000),
 ('07350119-2724-463d-b241-40f674caccf0'::uuid,2000),
 ('19223dab-a88d-4c35-a9a4-2bd1976bf3a2'::uuid,2000)
 )v(service_id,price)LOOP
  INSERT INTO public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note)
  SELECT s.id,s.name,s.category,r.price,v_at,'Cjenik od 1.1.2027. — odobreno od vlasnika'FROM public.services s WHERE s.id=r.service_id
  ON CONFLICT(service_id,starts_at)DO NOTHING;
 END LOOP;
 -- Seminar je nov: ostaje nacrt dok vlasnik ne dovrši opis i ne objavi uslugu.
 SELECT id INTO v_category FROM public.service_categories WHERE name='Učenički radovi - osnovna i srednja škola';
 IF v_category IS NOT NULL THEN
  SELECT id INTO v_service FROM public.services WHERE category_id=v_category AND slug='seminar';
  IF v_service IS NULL THEN
   INSERT INTO public.services(name,slug,description,category,price_cents,active)
   VALUES('Seminar','seminar','Seminar — opseg usluge i rok prema dogovoru.','Učenički radovi - osnovna i srednja škola',NULL,false)RETURNING id INTO v_service;
  END IF;
  INSERT INTO public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note)
  SELECT id,name,category,3000,v_at,'Novi seminar — cjenik od 1.1.2027.; objava usluge ostaje ručna'FROM public.services WHERE id=v_service
  ON CONFLICT(service_id,starts_at)DO NOTHING;
 END IF;
END$seed_2027$;
$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT count(*) AS broj_zakazanih_cijena_za_2027 FROM public.service_price_schedules WHERE starts_at='2027-01-01 00:00:00 Europe/Zagreb'::timestamptz AND status='pending';

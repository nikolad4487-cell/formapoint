-- FormaPoint 021: pet paketa od 1.1.2027. Primijeniti nakon nadogradnje 020.
BEGIN;
DO $guard$BEGIN IF to_regclass('public.service_price_schedules')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 020.';END IF;END$guard$;
-- Future package price lists. Existing packages and orders stay unchanged until the due date.
alter table public.service_price_schedules add column if not exists package_plan jsonb;
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.service_price_schedules'::regclass and conname='package_plan_array')then
  alter table public.service_price_schedules add constraint package_plan_array check(package_plan is null or jsonb_typeof(package_plan)='array');
 end if;
end$$;

create or replace function public.apply_due_service_prices()returns integer language plpgsql security definer set search_path=public as $$
declare r public.service_price_schedules;s public.services;p jsonb;vid uuid;ids uuid[];n integer:=0;begin
 if not exists(select 1 from public.service_price_schedules where status='pending'and starts_at<=now())then return 0;end if;
 perform pg_advisory_xact_lock(hashtextextended('scheduled-service-prices',0));
 for r in select * from public.service_price_schedules where status='pending'and starts_at<=now()order by starts_at,id for update loop
  select * into s from public.services where id=r.service_id for update;
  if not found or (s.packages_enabled and r.package_plan is null)then
   update public.service_price_schedules set status='skipped',last_error=case when s.id is null then'Usluga je izbrisana.'else'Usluga koristi pakete. Provjerite cijene paketa.'end where id=r.id;
   continue;
  end if;
  if r.package_plan is not null then
   -- Each package plan is atomic; a broken plan must not block other due changes.
   begin
    ids:='{}';
    if jsonb_array_length(r.package_plan)not between 1 and 100 then raise exception 'Neispravan broj paketa';end if;
    for p in select value from jsonb_array_elements(r.package_plan)loop
     if length(trim(coalesce(p->>'name','')))not between 2 and 150 or length(coalesce(p->>'description',''))>2000
       or (p->>'price_cents')is null or (p->>'price_cents')::integer not between 100 and 100000000
       or coalesce(p->>'period','')not in('one_time','week','month')then raise exception 'Neispravan paket';end if;
     vid:=(p->>'id')::uuid;
     if vid is null or vid=any(ids)or exists(select 1 from public.service_variants where id=vid and service_id<>s.id)then raise exception 'Neispravan identifikator paketa';end if;
     ids:=array_append(ids,vid);
     insert into public.service_variants(id,service_id,name,description,price_cents,period,active,archived,sort_order)
     values(vid,s.id,trim(p->>'name'),trim(coalesce(p->>'description','')),(p->>'price_cents')::integer,p->>'period',true,false,cardinality(ids))
     on conflict(id)do update set name=excluded.name,description=excluded.description,price_cents=excluded.price_cents,period=excluded.period,active=true,archived=false,sort_order=excluded.sort_order where service_variants.service_id=s.id;
     if not found then raise exception 'Paket ne pripada usluzi';end if;
    end loop;
    update public.service_variants set archived=true,active=false where service_id=s.id and not(id=any(ids));
    update public.services set packages_enabled=true where id=s.id;
    update public.service_price_schedules set status='applied',applied_at=now(),old_price_cents=s.price_cents,last_error=null where id=r.id;
    insert into public.audit_logs(actor_id,action,entity_id,details)values(r.created_by,'service.scheduled_packages_applied',s.id::text,jsonb_build_object('schedule_id',r.id,'starts_at',r.starts_at,'packages',r.package_plan));
    n:=n+1;
   exception when others then
    update public.service_price_schedules set status='skipped',last_error='Plan paketa nije primijenjen. Provjerite nazive, iznose i pripadnost paketa usluzi.'where id=r.id;
   end;
  else
   update public.services set price_cents=r.new_price_cents where id=s.id;
   update public.service_price_schedules set status='applied',applied_at=now(),old_price_cents=s.price_cents,last_error=null where id=r.id;
   insert into public.audit_logs(actor_id,action,entity_id,details)values(r.created_by,'service.scheduled_price_applied',s.id::text,jsonb_build_object('schedule_id',r.id,'starts_at',r.starts_at,'old_cents',s.price_cents,'new_cents',r.new_price_cents));
   n:=n+1;
  end if;
 end loop;return n;
end$$;
revoke all on function public.apply_due_service_prices()from public,anon,authenticated;
grant execute on function public.apply_due_service_prices()to service_role;

-- An ordinary base-price edit must not silently replace a package price list.
create or replace function public.schedule_service_price(p_service uuid,p_price integer,p_starts timestamptz,p_note text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare s public.services;sid uuid;actor uuid:=public.assert_user();begin
 perform public.assert_admin();
 if p_price is null or p_price not between 100 and 100000000 or p_starts is null or p_starts<=now()or length(coalesce(p_note,''))>1000 then raise exception 'Unesite cijenu od najmanje 1 EUR i budući datum početka';end if;
 select * into s from public.services where id=p_service for share;
 if not found or s.packages_enabled then raise exception 'Odaberite uslugu bez paketa. Cijene paketa uređuju se zasebno.';end if;
 insert into public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note,created_by)
 values(s.id,s.name,s.category,p_price,p_starts,coalesce(p_note,''),actor)
 on conflict(service_id,starts_at)do update set new_price_cents=excluded.new_price_cents,note=excluded.note,created_by=actor,status='pending',last_error=null
 where service_price_schedules.status<>'applied'and service_price_schedules.package_plan is null returning id into sid;
 if sid is null then raise exception 'Ta promjena već je primijenjena ili je za taj datum zakazan cjenik paketa';end if;
 insert into public.audit_logs(actor_id,action,entity_id,details)values(actor,'service.price_scheduled',s.id::text,jsonb_build_object('schedule_id',sid,'starts_at',p_starts,'new_cents',p_price));
 return sid;
end$$;
revoke all on function public.schedule_service_price(uuid,integer,timestamptz,text)from public,anon;
grant execute on function public.schedule_service_price(uuid,integer,timestamptz,text)to authenticated;

-- BEGIN APPROVED PACKAGE PLANS
DO $seed_packages$DECLARE r record;BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='202611230021')THEN RETURN;END IF;
 FOR r IN SELECT * FROM(VALUES
('958b7acd-8f18-4a93-a723-406c294cefa2'::uuid,$plan$[{"id":"20270101-0007-4000-8000-000000000001","name":"Jednokratno (do 4 sata)","description":"Jednokratno upravljanje i vođenje e-pošte, do 4 sata rada.","price_cents":7000,"period":"one_time"},{"id":"20270101-0007-4000-8000-000000000002","name":"Tjedno (3 sata dnevno, 5 dana)","description":"Upravljanje i vođenje e-pošte: 3 sata dnevno, 5 dana u tjednu, ukupno 15 sati.","price_cents":9000,"period":"week"},{"id":"20270101-0007-4000-8000-000000000003","name":"Mjesečno (4 sata dnevno, ponedjeljak – petak)","description":"Upravljanje i vođenje e-pošte: 4 sata dnevno, ponedjeljak – petak. Mjesečni paketi imaju fiksnu cijenu neovisno o broju radnih dana u mjesecu. Blagdani i drugi neradni dani uređuju se prema dogovoru.","price_cents":35000,"period":"month"}]$plan$::jsonb),
('0433f0e6-54ee-44fd-bbc2-842f492764c4'::uuid,$plan$[{"id":"20270101-0008-4000-8000-000000000001","name":"Online administracija – tjedna","description":"4 sata dnevno, 5 dana u tjednu, ukupno 20 sati.","price_cents":30000,"period":"week"},{"id":"20270101-0009-4000-8000-000000000001","name":"Online administracija – mjesečna","description":"4 sata dnevno, ponedjeljak – petak. Mjesečni paketi imaju fiksnu cijenu neovisno o broju radnih dana u mjesecu. Blagdani i drugi neradni dani uređuju se prema dogovoru.","price_cents":130000,"period":"month"}]$plan$::jsonb)
)v(service_id,packages)LOOP
  IF NOT EXISTS(SELECT 1 FROM public.services WHERE id=r.service_id)THEN RAISE EXCEPTION 'Nedostaje usluga za odobreni cjenik paketa: %',r.service_id;END IF;
  INSERT INTO public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note,package_plan)
  SELECT s.id,s.name,s.category,(SELECT min((p->>'price_cents')::integer)FROM jsonb_array_elements(r.packages)p),'2027-01-01 00:00:00 Europe/Zagreb'::timestamptz,'Odobreni cjenik paketa od 1.1.2027.',r.packages FROM public.services s WHERE s.id=r.service_id
  ON CONFLICT(service_id,starts_at)DO UPDATE SET package_plan=excluded.package_plan,new_price_cents=excluded.new_price_cents,note=excluded.note WHERE service_price_schedules.status='pending';
 END LOOP;
END$seed_packages$;
-- END APPROVED PACKAGE PLANS
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202611230021','scheduled_package_prices',ARRAY[$source$-- Future package price lists. Existing packages and orders stay unchanged until the due date.
alter table public.service_price_schedules add column if not exists package_plan jsonb;
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.service_price_schedules'::regclass and conname='package_plan_array')then
  alter table public.service_price_schedules add constraint package_plan_array check(package_plan is null or jsonb_typeof(package_plan)='array');
 end if;
end$$;

create or replace function public.apply_due_service_prices()returns integer language plpgsql security definer set search_path=public as $$
declare r public.service_price_schedules;s public.services;p jsonb;vid uuid;ids uuid[];n integer:=0;begin
 if not exists(select 1 from public.service_price_schedules where status='pending'and starts_at<=now())then return 0;end if;
 perform pg_advisory_xact_lock(hashtextextended('scheduled-service-prices',0));
 for r in select * from public.service_price_schedules where status='pending'and starts_at<=now()order by starts_at,id for update loop
  select * into s from public.services where id=r.service_id for update;
  if not found or (s.packages_enabled and r.package_plan is null)then
   update public.service_price_schedules set status='skipped',last_error=case when s.id is null then'Usluga je izbrisana.'else'Usluga koristi pakete. Provjerite cijene paketa.'end where id=r.id;
   continue;
  end if;
  if r.package_plan is not null then
   -- Each package plan is atomic; a broken plan must not block other due changes.
   begin
    ids:='{}';
    if jsonb_array_length(r.package_plan)not between 1 and 100 then raise exception 'Neispravan broj paketa';end if;
    for p in select value from jsonb_array_elements(r.package_plan)loop
     if length(trim(coalesce(p->>'name','')))not between 2 and 150 or length(coalesce(p->>'description',''))>2000
       or (p->>'price_cents')is null or (p->>'price_cents')::integer not between 100 and 100000000
       or coalesce(p->>'period','')not in('one_time','week','month')then raise exception 'Neispravan paket';end if;
     vid:=(p->>'id')::uuid;
     if vid is null or vid=any(ids)or exists(select 1 from public.service_variants where id=vid and service_id<>s.id)then raise exception 'Neispravan identifikator paketa';end if;
     ids:=array_append(ids,vid);
     insert into public.service_variants(id,service_id,name,description,price_cents,period,active,archived,sort_order)
     values(vid,s.id,trim(p->>'name'),trim(coalesce(p->>'description','')),(p->>'price_cents')::integer,p->>'period',true,false,cardinality(ids))
     on conflict(id)do update set name=excluded.name,description=excluded.description,price_cents=excluded.price_cents,period=excluded.period,active=true,archived=false,sort_order=excluded.sort_order where service_variants.service_id=s.id;
     if not found then raise exception 'Paket ne pripada usluzi';end if;
    end loop;
    update public.service_variants set archived=true,active=false where service_id=s.id and not(id=any(ids));
    update public.services set packages_enabled=true where id=s.id;
    update public.service_price_schedules set status='applied',applied_at=now(),old_price_cents=s.price_cents,last_error=null where id=r.id;
    insert into public.audit_logs(actor_id,action,entity_id,details)values(r.created_by,'service.scheduled_packages_applied',s.id::text,jsonb_build_object('schedule_id',r.id,'starts_at',r.starts_at,'packages',r.package_plan));
    n:=n+1;
   exception when others then
    update public.service_price_schedules set status='skipped',last_error='Plan paketa nije primijenjen. Provjerite nazive, iznose i pripadnost paketa usluzi.'where id=r.id;
   end;
  else
   update public.services set price_cents=r.new_price_cents where id=s.id;
   update public.service_price_schedules set status='applied',applied_at=now(),old_price_cents=s.price_cents,last_error=null where id=r.id;
   insert into public.audit_logs(actor_id,action,entity_id,details)values(r.created_by,'service.scheduled_price_applied',s.id::text,jsonb_build_object('schedule_id',r.id,'starts_at',r.starts_at,'old_cents',s.price_cents,'new_cents',r.new_price_cents));
   n:=n+1;
  end if;
 end loop;return n;
end$$;
revoke all on function public.apply_due_service_prices()from public,anon,authenticated;
grant execute on function public.apply_due_service_prices()to service_role;

-- An ordinary base-price edit must not silently replace a package price list.
create or replace function public.schedule_service_price(p_service uuid,p_price integer,p_starts timestamptz,p_note text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare s public.services;sid uuid;actor uuid:=public.assert_user();begin
 perform public.assert_admin();
 if p_price is null or p_price not between 100 and 100000000 or p_starts is null or p_starts<=now()or length(coalesce(p_note,''))>1000 then raise exception 'Unesite cijenu od najmanje 1 EUR i budući datum početka';end if;
 select * into s from public.services where id=p_service for share;
 if not found or s.packages_enabled then raise exception 'Odaberite uslugu bez paketa. Cijene paketa uređuju se zasebno.';end if;
 insert into public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note,created_by)
 values(s.id,s.name,s.category,p_price,p_starts,coalesce(p_note,''),actor)
 on conflict(service_id,starts_at)do update set new_price_cents=excluded.new_price_cents,note=excluded.note,created_by=actor,status='pending',last_error=null
 where service_price_schedules.status<>'applied'and service_price_schedules.package_plan is null returning id into sid;
 if sid is null then raise exception 'Ta promjena već je primijenjena ili je za taj datum zakazan cjenik paketa';end if;
 insert into public.audit_logs(actor_id,action,entity_id,details)values(actor,'service.price_scheduled',s.id::text,jsonb_build_object('schedule_id',sid,'starts_at',p_starts,'new_cents',p_price));
 return sid;
end$$;
revoke all on function public.schedule_service_price(uuid,integer,timestamptz,text)from public,anon;
grant execute on function public.schedule_service_price(uuid,integer,timestamptz,text)to authenticated;

-- BEGIN APPROVED PACKAGE PLANS
DO $seed_packages$DECLARE r record;BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='202611230021')THEN RETURN;END IF;
 FOR r IN SELECT * FROM(VALUES
('958b7acd-8f18-4a93-a723-406c294cefa2'::uuid,$plan$[{"id":"20270101-0007-4000-8000-000000000001","name":"Jednokratno (do 4 sata)","description":"Jednokratno upravljanje i vođenje e-pošte, do 4 sata rada.","price_cents":7000,"period":"one_time"},{"id":"20270101-0007-4000-8000-000000000002","name":"Tjedno (3 sata dnevno, 5 dana)","description":"Upravljanje i vođenje e-pošte: 3 sata dnevno, 5 dana u tjednu, ukupno 15 sati.","price_cents":9000,"period":"week"},{"id":"20270101-0007-4000-8000-000000000003","name":"Mjesečno (4 sata dnevno, ponedjeljak – petak)","description":"Upravljanje i vođenje e-pošte: 4 sata dnevno, ponedjeljak – petak. Mjesečni paketi imaju fiksnu cijenu neovisno o broju radnih dana u mjesecu. Blagdani i drugi neradni dani uređuju se prema dogovoru.","price_cents":35000,"period":"month"}]$plan$::jsonb),
('0433f0e6-54ee-44fd-bbc2-842f492764c4'::uuid,$plan$[{"id":"20270101-0008-4000-8000-000000000001","name":"Online administracija – tjedna","description":"4 sata dnevno, 5 dana u tjednu, ukupno 20 sati.","price_cents":30000,"period":"week"},{"id":"20270101-0009-4000-8000-000000000001","name":"Online administracija – mjesečna","description":"4 sata dnevno, ponedjeljak – petak. Mjesečni paketi imaju fiksnu cijenu neovisno o broju radnih dana u mjesecu. Blagdani i drugi neradni dani uređuju se prema dogovoru.","price_cents":130000,"period":"month"}]$plan$::jsonb)
)v(service_id,packages)LOOP
  IF NOT EXISTS(SELECT 1 FROM public.services WHERE id=r.service_id)THEN RAISE EXCEPTION 'Nedostaje usluga za odobreni cjenik paketa: %',r.service_id;END IF;
  INSERT INTO public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,note,package_plan)
  SELECT s.id,s.name,s.category,(SELECT min((p->>'price_cents')::integer)FROM jsonb_array_elements(r.packages)p),'2027-01-01 00:00:00 Europe/Zagreb'::timestamptz,'Odobreni cjenik paketa od 1.1.2027.',r.packages FROM public.services s WHERE s.id=r.service_id
  ON CONFLICT(service_id,starts_at)DO UPDATE SET package_plan=excluded.package_plan,new_price_cents=excluded.new_price_cents,note=excluded.note WHERE service_price_schedules.status='pending';
 END LOOP;
END$seed_packages$;
-- END APPROVED PACKAGE PLANS
NOTIFY pgrst,'reload schema';
$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT service_name,starts_at,status,jsonb_array_length(package_plan)AS broj_paketa FROM public.service_price_schedules WHERE package_plan IS NOT NULL ORDER BY service_name;

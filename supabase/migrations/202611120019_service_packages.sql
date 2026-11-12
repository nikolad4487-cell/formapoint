-- Paketi koriste postojeću tablicu service_variants.
alter table public.services add column if not exists packages_enabled boolean not null default false;
alter table public.service_variants
 add column if not exists description text not null default '',
 add column if not exists period text not null default 'one_time' check(period in('one_time','week','month')),
 add column if not exists active boolean not null default true,
 add column if not exists archived boolean not null default false,
 add column if not exists sort_order integer not null default 0;
alter table public.cart_items add column if not exists variant_id uuid;
do $$begin
 if not exists(select 1 from pg_constraint where conname='variants_service_id_id_key'and conrelid='public.service_variants'::regclass)then
  alter table public.service_variants add constraint variants_service_id_id_key unique(service_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='cart_variant_service_fk'and conrelid='public.cart_items'::regclass)then
  alter table public.cart_items add constraint cart_variant_service_fk foreign key(service_id,variant_id)references public.service_variants(service_id,id);
 end if;
end$$;
alter table public.cart_items drop constraint if exists cart_items_cart_id_service_id_key;
create unique index if not exists cart_item_variant_unique on public.cart_items(cart_id,service_id,variant_id)nulls not distinct;
alter table public.order_items add column if not exists variant_id uuid references public.service_variants on delete set null,
 add column if not exists variant_name text,add column if not exists variant_description text,add column if not exists variant_period text;
grant select on public.service_variants to anon,authenticated;
drop policy if exists variant_public_read on public.service_variants;
create policy variant_public_read on public.service_variants for select to anon,authenticated using(public.is_admin()or(active and not archived and exists(select 1 from public.services s where s.id=service_id and s.active and s.packages_enabled)));

create or replace function public.save_service_packages(p_service uuid,p_enabled boolean,p_packages jsonb)returns void
language plpgsql security definer set search_path=public as $$declare r jsonb;vid uuid;ids uuid[]:='{}';begin
 perform public.assert_admin();
 perform 1 from public.services where id=p_service for update;
 if not found then raise exception 'Usluga više nije dostupna';end if;
 if p_enabled is null or jsonb_typeof(p_packages)is distinct from 'array'or jsonb_array_length(p_packages)>100 then raise exception 'Provjerite popis paketa';end if;
 if p_enabled and not exists(select 1 from jsonb_array_elements(p_packages)v where coalesce((v->>'active')::boolean,true))then raise exception 'Uključite barem jedan paket ili isključite pakete';end if;
 for r in select value from jsonb_array_elements(p_packages)loop
  if r->>'name'is null or length(trim(r->>'name'))not between 2 and 150 or length(coalesce(r->>'description',''))>2000 or(r->>'price_cents')is null or(r->>'price_cents')::integer not between 100 and 100000000 or coalesce(r->>'period','one_time')not in('one_time','week','month')then raise exception 'Unesite naziv, opis i cijenu paketa od najmanje 1 EUR';end if;
  vid:=coalesce(nullif(r->>'id','')::uuid,gen_random_uuid());
  if vid=any(ids)or exists(select 1 from public.service_variants where id=vid and service_id<>p_service)then raise exception 'Paket ne pripada odabranoj usluzi ili se ponavlja';end if;
  ids:=array_append(ids,vid);
  insert into public.service_variants(id,service_id,name,description,price_cents,period,active,archived,sort_order)
  values(vid,p_service,trim(r->>'name'),trim(coalesce(r->>'description','')),(r->>'price_cents')::integer,coalesce(r->>'period','one_time'),coalesce((r->>'active')::boolean,true),false,cardinality(ids))
  on conflict(id)do update set name=excluded.name,description=excluded.description,price_cents=excluded.price_cents,period=excluded.period,active=excluded.active,archived=false,sort_order=excluded.sort_order where service_variants.service_id=p_service;
  if not found then raise exception 'Paket ne pripada ovoj usluzi';end if;
 end loop;
 update public.service_variants set archived=true,active=false where service_id=p_service and not(id=any(ids));
 update public.services set packages_enabled=p_enabled where id=p_service;
 insert into public.audit_logs(actor_id,action,entity_id,details)values(auth.uid(),'service.packages_saved',p_service::text,jsonb_build_object('enabled',p_enabled,'packages',p_packages));
end$$;
revoke all on function public.save_service_packages(uuid,boolean,jsonb)from public,anon;
grant execute on function public.save_service_packages(uuid,boolean,jsonb)to authenticated;

create or replace function public.cart_set_variant(p_service uuid,p_variant uuid,p_quantity integer)returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();c uuid;s public.services;begin
 perform public.rate_limit('cart:'||u,120,60);
 if p_quantity is null or p_quantity not between 0 and 100 then raise exception 'Neispravna količina';end if;
 insert into public.carts(user_id)values(u)on conflict(user_id)do update set user_id=excluded.user_id returning id into c;
 if p_quantity=0 then delete from public.cart_items where cart_id=c and service_id=p_service and variant_id is not distinct from p_variant;return;end if;
 select * into s from public.services where id=p_service and active for share;
 if not found then raise exception 'Usluga nije dostupna';end if;
 if s.packages_enabled then
  if p_variant is null or not exists(select 1 from public.service_variants where id=p_variant and service_id=p_service and active and not archived)then raise exception 'Odaberite aktivni paket ove usluge';end if;
 elsif p_variant is not null or s.price_cents is null then raise exception 'Usluga zahtijeva ponudu ili odabrani paket nije dostupan';end if;
 insert into public.cart_items(cart_id,service_id,variant_id,quantity)values(c,p_service,p_variant,p_quantity)
 on conflict(cart_id,service_id,variant_id)do update set quantity=excluded.quantity;
end$$;
create or replace function public.cart_add_variant(p_service uuid,p_variant uuid,p_quantity integer default 1)returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();c uuid;n integer;begin
 if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Neispravna količina';end if;
 insert into public.carts(user_id)values(u)on conflict(user_id)do update set user_id=excluded.user_id returning id into c;
 select coalesce((select quantity from public.cart_items where cart_id=c and service_id=p_service and variant_id is not distinct from p_variant),0)+p_quantity into n;
 if n>100 then raise exception 'Najviše 100 komada po paketu';end if;
 perform public.cart_set_variant(p_service,p_variant,n);
end$$;
create or replace function public.cart_set(p_service uuid,p_quantity integer)returns void language plpgsql security definer set search_path=public as $$begin perform public.cart_set_variant(p_service,null,p_quantity);end$$;
create or replace function public.cart_add(p_service uuid,p_quantity integer default 1)returns void language plpgsql security definer set search_path=public as $$begin perform public.cart_add_variant(p_service,null,p_quantity);end$$;
revoke all on function public.cart_set_variant(uuid,uuid,integer),public.cart_add_variant(uuid,uuid,integer)from public,anon;
grant execute on function public.cart_set_variant(uuid,uuid,integer),public.cart_add_variant(uuid,uuid,integer)to authenticated;

create or replace function public.cart_pricing_before_guest(p_promo text default null)returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();r record;promo public.promo_codes;subtotal bigint:=0;eligible bigint:=0;discount integer:=0;split_ok boolean:=true;item_count integer:=0;
begin
 for r in select ci.quantity,ci.variant_id,s.*,case when ci.variant_id is null then s.price_cents else v.price_cents end as unit_price,v.active as variant_active,v.archived as variant_archived from public.cart_items ci join public.carts c on c.id=ci.cart_id left join public.services s on s.id=ci.service_id left join public.service_variants v on v.id=ci.variant_id and v.service_id=ci.service_id where c.user_id=u order by ci.id loop
  if r.id is null or not r.active or r.unit_price is null or(r.packages_enabled and(r.variant_id is null or not r.variant_active or r.variant_archived))or(not r.packages_enabled and r.variant_id is not null) then raise exception 'U košarici je nedostupan artikl ili artikl koji zahtijeva individualnu ponudu.';end if;
  item_count:=item_count+1;subtotal:=subtotal+r.unit_price::bigint*r.quantity;
  split_ok:=split_ok and r.split_enabled and r.unit_price::bigint*r.quantity>=r.split_min_cents;
 end loop;
 if item_count=0 then raise exception 'Košarica je prazna';end if;
 if item_count>100 or subtotal>100000000 then raise exception 'Košarica prelazi dopušteni iznos ili broj artikala.';end if;
 if coalesce(trim(p_promo),'')<>''then
  select * into promo from public.promo_codes where code=upper(trim(p_promo));
  if not found or not promo.active or promo.expires_at<=now()or(promo.customer_id is not null and promo.customer_id<>u)then raise exception 'Kupon nije primjenjiv';end if;
  if exists(select 1 from public.promo_code_uses where promo_id=promo.id and user_id=u)or(select count(*)from public.promo_code_uses where promo_id=promo.id)>=promo.max_uses then raise exception 'Kupon je iskorišten';end if;
  if promo.first_order_only and exists(select 1 from public.orders where user_id=u)then raise exception 'Kupon vrijedi samo za prvu narudžbu korisnika koji još nikad nije naručio.';end if;
  select coalesce(sum((case when ci.variant_id is null then s.price_cents else v.price_cents end)::bigint*ci.quantity),0)into eligible from public.cart_items ci join public.carts c on c.id=ci.cart_id join public.services s on s.id=ci.service_id left join public.service_variants v on v.id=ci.variant_id where c.user_id=u and(promo.service_id is null or promo.service_id=s.id);
  if eligible=0 then raise exception 'Kupon ne vrijedi za odabrane artikle';end if;
  discount:=least(eligible,case when promo.kind='fixed'then promo.value else floor(eligible::numeric*promo.value/100)::int end);
 end if;
 if subtotal-discount<100 then raise exception 'Najmanji iznos nakon popusta je 1 EUR';end if;
 return jsonb_build_object('subtotal',subtotal,'discount',discount,'total',subtotal-discount,'split',split_ok and subtotal-discount>=200,'count',item_count);
end$$;


create or replace function public.checkout_cart_order(p_request uuid,p_title text,p_description text,p_due timestamptz,p_method text,p_model text,p_details jsonb default '{}',p_promo text default null)returns uuid
language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();c uuid;oid uuid;price jsonb;options jsonb;b public.business_settings;details jsonb:='{}';k text;v text;promo_id uuid;total integer;
begin
 if p_request is null then raise exception 'Nedostaje identifikator potvrde';end if;
 select id into oid from public.orders where user_id=u and checkout_request_id=p_request;if found then return oid;end if;
 select id into c from public.carts where user_id=u for update;
 select id into oid from public.orders where user_id=u and checkout_request_id=p_request;if found then return oid;end if;
 if c is null then raise exception 'Košarica je prazna';end if;
 perform public.rate_limit('cart-checkout:'||u,20,3600);
 if p_method is null or p_method not in('card','google_pay','apple_pay','bank')or p_model is null or p_model not in('full','split')or(p_method in('google_pay','apple_pay')and p_model<>'full')then raise exception 'Neispravan način plaćanja';end if;
 if p_due is null or p_due<=now()then raise exception 'Unesite budući rok isporuke';end if;
 if length(trim(p_title))not between 3 and 150 or length(trim(p_description))not between 10 and 10000 then raise exception 'Unesite naslov i detaljne upute';end if;
 if jsonb_typeof(p_details)is distinct from 'object'then raise exception 'Neispravni podaci narudžbe';end if;
 foreach k in array array['course','school','mentor','student','year','place']loop
  v:=trim(coalesce(p_details->>k,''));if length(v)>400 then raise exception 'Predugački podaci narudžbe';end if;details:=details||jsonb_build_object(k,v);
 end loop;
 if coalesce(details->>'course','')=''then raise exception 'Unesite predmet ili područje';end if;
 -- Zaključavanje artikala štiti cijene i dostupnost do završetka transakcije.
 perform s.id from public.services s join public.cart_items ci on ci.service_id=s.id where ci.cart_id=c order by s.id for share of s;
 perform v.id from public.service_variants v join public.cart_items ci on ci.variant_id=v.id where ci.cart_id=c order by v.id for share of v;
 if coalesce(trim(p_promo),'')<>''then
  select id into promo_id from public.promo_codes where code=upper(trim(p_promo))for update;
 end if;
 price:=public.cart_pricing(p_promo);total:=(price->>'total')::integer;
 if p_model='split'and not(price->>'split')::boolean then raise exception 'Plaćanje 50/50 nije dostupno za ovu košaricu';end if;
 if p_method='bank'then select * into b from public.business_settings where id=true for share;end if;
 options:=public.checkout_options();if not coalesce((options->>p_method)::boolean,false)then raise exception 'Odabrani način plaćanja trenutačno nije dostupan';end if;
 insert into public.orders(user_id,title,description,total_cents,payment_model,due_at,status,payment_method,checkout_details,checkout_request_id,bank_instructions)
 values(u,trim(p_title),trim(p_description),total,p_model,p_due,'deposit_pending',p_method,details,p_request,
 case when p_method='bank'then jsonb_build_object('recipient',b.payment_recipient,'iban',b.iban,'bank',b.bank_name)end)returning id into oid;
 insert into public.order_items(order_id,service_id,variant_id,name,quantity,unit_cents)select oid,s.id,ci.variant_id,s.name,ci.quantity,case when ci.variant_id is null then s.price_cents else v.price_cents end from public.cart_items ci join public.services s on s.id=ci.service_id left join public.service_variants v on v.id=ci.variant_id where ci.cart_id=c;
 insert into public.payment_installments(order_id,installment,amount_cents)values(oid,1,case when p_model='split'then(total+1)/2 else total end);
 if p_model='split'then insert into public.payment_installments(order_id,installment,amount_cents)values(oid,2,total/2);end if;
 if promo_id is not null then insert into public.promo_code_uses(promo_id,user_id,order_id)values(promo_id,u,oid);end if;
 delete from public.cart_items where cart_id=c;
 return oid;
end$$;


-- Snimka paketa ostaje čitljiva nakon izmjene ili brisanja kataloga.
create or replace function public.order_item_package_snapshot()returns trigger language plpgsql security definer set search_path=public as $$
declare s public.services;v public.service_variants;begin
 select * into s from public.services where id=new.service_id;
 if new.variant_id is null then
  if s.packages_enabled then raise exception 'Za ovu uslugu odaberite paket u košarici';end if;
 else
  select * into v from public.service_variants where id=new.variant_id and service_id=new.service_id and active and not archived;
  if not found or not s.packages_enabled then raise exception 'Paket nije dostupan za ovu uslugu';end if;
  new.name:=s.name||' — '||v.name;new.unit_cents:=v.price_cents;new.variant_name:=v.name;new.variant_description:=v.description;new.variant_period:=v.period;
 end if;return new;
end$$;
revoke all on function public.order_item_package_snapshot()from public,anon,authenticated;
drop trigger if exists order_item_package_snapshot on public.order_items;
create trigger order_item_package_snapshot before insert on public.order_items for each row execute function public.order_item_package_snapshot();
NOTIFY pgrst,'reload schema';

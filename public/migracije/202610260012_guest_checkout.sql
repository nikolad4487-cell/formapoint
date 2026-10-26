-- Pokrenite cijelu datoteku jednom nakon nadogradnje 011.
BEGIN;
DO $guard$BEGIN
 IF to_regprocedure('public.configure_bank_method(boolean)') IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 011.';END IF;
 IF to_regprocedure('public.save_guest_contact(text,text,text,boolean)') IS NOT NULL THEN RAISE EXCEPTION 'Nadogradnja 012 već je primijenjena.';END IF;
END $guard$;
-- Gost ostaje zaseban vlasnik svojih narudžbi; kontaktni e-mail nije dokaz identiteta.
alter table public.profiles add column contact_email text
 check(contact_email is null or (length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));

create function public.save_guest_contact(p_first text,p_last text,p_email text,p_terms boolean)returns void
language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();
begin
 if not exists(select 1 from auth.users where id=u and is_anonymous)then return;end if;
 if not coalesce(p_terms,false)then raise exception 'Prihvatite uvjete korištenja';end if;
 if p_first is null or length(trim(p_first))not between 1 and 150 or p_last is null or length(trim(p_last))not between 1 and 150 then raise exception 'Unesite ime i prezime';end if;
 if p_email is null or length(trim(p_email))>254 or trim(p_email)!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'then raise exception 'Unesite ispravan kontaktni e-mail';end if;
 perform public.rate_limit('guest-contact:'||u,20,3600);
 update public.profiles set first_name=trim(p_first),last_name=trim(p_last),contact_email=lower(trim(p_email)),terms_accepted_at=now()where id=u;
end$$;

create function public.guest_order_contact()returns trigger
language plpgsql security definer set search_path=public as $$
declare p public.profiles;
begin
 if exists(select 1 from auth.users where id=new.user_id and is_anonymous)then
  select * into p from public.profiles where id=new.user_id for share;
  if p.contact_email is null or trim(p.first_name)=''or trim(p.last_name)=''or p.terms_accepted_at is null then raise exception 'Za kupnju kao gost unesite ime, prezime i kontaktni e-mail te prihvatite uvjete.';end if;
  new.checkout_details:=new.checkout_details||jsonb_build_object('guest_name',p.first_name||' '||p.last_name,'guest_email',p.contact_email);
 end if;
 return new;
end$$;
create trigger guest_contact_before_order before insert on public.orders for each row execute function public.guest_order_contact();

create or replace function public.admin_users(p_search text default '',p_offset integer default 0,p_limit integer default 25)
 returns table(id uuid,first_name text,last_name text,email text,phone text,roles text[],created_at timestamptz,order_count bigint)
 language plpgsql security definer set search_path=public as $$begin perform public.assert_admin();
 return query select p.id,p.first_name,p.last_name,coalesce(nullif(u.email,''),p.contact_email)::text,p.phone,array(select r.role from public.user_roles r where r.user_id=p.id),p.created_at,(select count(*)from public.orders o where o.user_id=p.id)
 from public.profiles p join auth.users u on u.id=p.id where p.first_name||' '||p.last_name||' '||coalesce(nullif(u.email,''),p.contact_email,'') ilike '%'||left(p_search,150)||'%' order by p.created_at desc,p.id offset greatest(0,p_offset)limit least(100,greatest(1,p_limit));end$$;

revoke all on function public.save_guest_contact(text,text,text,boolean),public.guest_order_contact()from public,anon,authenticated;
grant execute on function public.save_guest_contact(text,text,text,boolean)to authenticated;

-- Jedan kontaktni e-mail ne dobiva novi popust ponovnim otvaranjem gostujuće sesije.
create function public.checkout_contact_email(p_user uuid)returns text
language sql stable security definer set search_path=public as $$
 select lower(coalesce(nullif(u.email,''),p.contact_email)) from auth.users u join public.profiles p on p.id=u.id where u.id=p_user
$$;
alter function public.cart_pricing(text)rename to cart_pricing_before_guest;
create function public.cart_pricing(p_promo text default null)returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();mail text:=public.checkout_contact_email(u);promo public.promo_codes;
begin
 if mail is not null and coalesce(trim(p_promo),'')<>''then
  select * into promo from public.promo_codes where code=upper(trim(p_promo));
  if promo.first_order_only and exists(select 1 from public.orders o where public.checkout_contact_email(o.user_id)=mail)then raise exception 'Kupon vrijedi samo za prvu narudžbu.';end if;
  if exists(select 1 from public.promo_code_uses pc where pc.promo_id=promo.id and public.checkout_contact_email(pc.user_id)=mail)then raise exception 'Kupon je iskorišten';end if;
 end if;
 return public.cart_pricing_before_guest(p_promo);
end$$;
create function public.guest_promo_guard()returns trigger
language plpgsql security definer set search_path=public as $$
declare mail text:=public.checkout_contact_email(new.user_id);first_only boolean;
begin
 if mail is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('checkout-contact:'||mail,0));
 select first_order_only into first_only from public.promo_codes where id=new.promo_id;
 if first_only and exists(select 1 from public.orders o where o.id<>new.order_id and public.checkout_contact_email(o.user_id)=mail)then raise exception 'Kupon vrijedi samo za prvu narudžbu.';end if;
 if exists(select 1 from public.promo_code_uses pc where pc.promo_id=new.promo_id and public.checkout_contact_email(pc.user_id)=mail)then raise exception 'Kupon je iskorišten';end if;
 return new;
end$$;
create trigger guest_promo_before_use before insert on public.promo_code_uses for each row execute function public.guest_promo_guard();
revoke all on function public.cart_pricing_before_guest(text),public.checkout_contact_email(uuid),public.guest_promo_guard(),public.cart_pricing(text)from public,anon,authenticated;
grant execute on function public.cart_pricing(text)to authenticated;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610260012','guest_checkout',ARRAY[$source$-- Gost ostaje zaseban vlasnik svojih narudžbi; kontaktni e-mail nije dokaz identiteta.
alter table public.profiles add column contact_email text
 check(contact_email is null or (length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));

create function public.save_guest_contact(p_first text,p_last text,p_email text,p_terms boolean)returns void
language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();
begin
 if not exists(select 1 from auth.users where id=u and is_anonymous)then return;end if;
 if not coalesce(p_terms,false)then raise exception 'Prihvatite uvjete korištenja';end if;
 if p_first is null or length(trim(p_first))not between 1 and 150 or p_last is null or length(trim(p_last))not between 1 and 150 then raise exception 'Unesite ime i prezime';end if;
 if p_email is null or length(trim(p_email))>254 or trim(p_email)!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'then raise exception 'Unesite ispravan kontaktni e-mail';end if;
 perform public.rate_limit('guest-contact:'||u,20,3600);
 update public.profiles set first_name=trim(p_first),last_name=trim(p_last),contact_email=lower(trim(p_email)),terms_accepted_at=now()where id=u;
end$$;

create function public.guest_order_contact()returns trigger
language plpgsql security definer set search_path=public as $$
declare p public.profiles;
begin
 if exists(select 1 from auth.users where id=new.user_id and is_anonymous)then
  select * into p from public.profiles where id=new.user_id for share;
  if p.contact_email is null or trim(p.first_name)=''or trim(p.last_name)=''or p.terms_accepted_at is null then raise exception 'Za kupnju kao gost unesite ime, prezime i kontaktni e-mail te prihvatite uvjete.';end if;
  new.checkout_details:=new.checkout_details||jsonb_build_object('guest_name',p.first_name||' '||p.last_name,'guest_email',p.contact_email);
 end if;
 return new;
end$$;
create trigger guest_contact_before_order before insert on public.orders for each row execute function public.guest_order_contact();

create or replace function public.admin_users(p_search text default '',p_offset integer default 0,p_limit integer default 25)
 returns table(id uuid,first_name text,last_name text,email text,phone text,roles text[],created_at timestamptz,order_count bigint)
 language plpgsql security definer set search_path=public as $$begin perform public.assert_admin();
 return query select p.id,p.first_name,p.last_name,coalesce(nullif(u.email,''),p.contact_email)::text,p.phone,array(select r.role from public.user_roles r where r.user_id=p.id),p.created_at,(select count(*)from public.orders o where o.user_id=p.id)
 from public.profiles p join auth.users u on u.id=p.id where p.first_name||' '||p.last_name||' '||coalesce(nullif(u.email,''),p.contact_email,'') ilike '%'||left(p_search,150)||'%' order by p.created_at desc,p.id offset greatest(0,p_offset)limit least(100,greatest(1,p_limit));end$$;

revoke all on function public.save_guest_contact(text,text,text,boolean),public.guest_order_contact()from public,anon,authenticated;
grant execute on function public.save_guest_contact(text,text,text,boolean)to authenticated;

-- Jedan kontaktni e-mail ne dobiva novi popust ponovnim otvaranjem gostujuće sesije.
create function public.checkout_contact_email(p_user uuid)returns text
language sql stable security definer set search_path=public as $$
 select lower(coalesce(nullif(u.email,''),p.contact_email)) from auth.users u join public.profiles p on p.id=u.id where u.id=p_user
$$;
alter function public.cart_pricing(text)rename to cart_pricing_before_guest;
create function public.cart_pricing(p_promo text default null)returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();mail text:=public.checkout_contact_email(u);promo public.promo_codes;
begin
 if mail is not null and coalesce(trim(p_promo),'')<>''then
  select * into promo from public.promo_codes where code=upper(trim(p_promo));
  if promo.first_order_only and exists(select 1 from public.orders o where public.checkout_contact_email(o.user_id)=mail)then raise exception 'Kupon vrijedi samo za prvu narudžbu.';end if;
  if exists(select 1 from public.promo_code_uses pc where pc.promo_id=promo.id and public.checkout_contact_email(pc.user_id)=mail)then raise exception 'Kupon je iskorišten';end if;
 end if;
 return public.cart_pricing_before_guest(p_promo);
end$$;
create function public.guest_promo_guard()returns trigger
language plpgsql security definer set search_path=public as $$
declare mail text:=public.checkout_contact_email(new.user_id);first_only boolean;
begin
 if mail is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('checkout-contact:'||mail,0));
 select first_order_only into first_only from public.promo_codes where id=new.promo_id;
 if first_only and exists(select 1 from public.orders o where o.id<>new.order_id and public.checkout_contact_email(o.user_id)=mail)then raise exception 'Kupon vrijedi samo za prvu narudžbu.';end if;
 if exists(select 1 from public.promo_code_uses pc where pc.promo_id=new.promo_id and public.checkout_contact_email(pc.user_id)=mail)then raise exception 'Kupon je iskorišten';end if;
 return new;
end$$;
create trigger guest_promo_before_use before insert on public.promo_code_uses for each row execute function public.guest_promo_guard();
revoke all on function public.cart_pricing_before_guest(text),public.checkout_contact_email(uuid),public.guest_promo_guard(),public.cart_pricing(text)from public,anon,authenticated;
grant execute on function public.cart_pricing(text)to authenticated;
$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Kupnja kao gost spremna. U Auth postavkama uključite Anonymous Sign-Ins, isključite Confirm email i postavite minimalnu lozinku na 8.' AS rezultat;

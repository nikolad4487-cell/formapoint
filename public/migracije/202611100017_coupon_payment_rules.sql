-- FormaPoint: POPUST10 samo uz jednokratno kartično plaćanje. Nakon nadogradnje 014.
BEGIN;
DO $guard$BEGIN IF to_regclass('public.promotion_campaigns')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 014.';END IF;END$guard$;
alter table public.promo_codes add column if not exists payment_restriction text not null default 'any' check(payment_restriction in('any','card_full'));
-- Pravilo vrijedi i ako se POPUST10 kasnije ponovno kreira.
create or replace function public.set_popust10_policy()returns trigger language plpgsql set search_path=public as $$begin
 if upper(trim(new.code))='POPUST10'then new.payment_restriction:='card_full';new.first_order_only:=true;end if;return new;
end$$;
revoke all on function public.set_popust10_policy()from public,anon,authenticated;
drop trigger if exists popust10_policy on public.promo_codes;
create trigger popust10_policy before insert or update on public.promo_codes for each row execute function public.set_popust10_policy();
update public.promo_codes set payment_restriction='card_full',first_order_only=true where upper(trim(code))='POPUST10';

create or replace function public.promo_payment_guard()returns trigger language plpgsql security definer set search_path=public as $$
declare restricted boolean;o public.orders;begin
 select payment_restriction='card_full'into restricted from public.promo_codes where id=new.promo_id for share;
 if restricted then
  select * into o from public.orders where id=new.order_id for update;
  if o.payment_method<>'card'or o.payment_model<>'full'then raise exception 'Ovaj kupon vrijedi samo za jednokratno plaćanje karticom. Ne vrijedi za 50/50 ni IBAN.';end if;
  -- Sačuvano pravilo ne nestaje naknadnim preimenovanjem ili brisanjem kupona.
  update public.orders set checkout_details=checkout_details||'{"coupon_card_full":true}'::jsonb where id=o.id;
 end if;return new;
end$$;
revoke all on function public.promo_payment_guard()from public,anon,authenticated;
drop trigger if exists promo_payment_before_use on public.promo_code_uses;
create trigger promo_payment_before_use before insert on public.promo_code_uses for each row execute function public.promo_payment_guard();

create or replace function public.order_coupon_payment_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 if(new.payment_method is distinct from old.payment_method or new.payment_model is distinct from old.payment_model)and(
 old.checkout_details->>'coupon_card_full'='true'or exists(select 1 from public.promo_code_uses u join public.promo_codes p on p.id=u.promo_id where u.order_id=old.id and p.payment_restriction='card_full'))and(new.payment_method<>'card'or new.payment_model<>'full')then
 raise exception 'Narudžba s ovim kuponom dopušta samo jednokratno plaćanje karticom.';
 end if;return new;
end$$;
revoke all on function public.order_coupon_payment_guard()from public,anon,authenticated;
drop trigger if exists order_coupon_payment on public.orders;
create trigger order_coupon_payment before update of payment_method,payment_model on public.orders for each row execute function public.order_coupon_payment_guard();

-- Sačuvaj izračun i postojeće provjere prve narudžbe, datuma, vlasnika i gostiju.
do $$begin if to_regprocedure('public.cart_pricing_before_payment_rules(text)')is null then
 alter function public.cart_pricing(text)rename to cart_pricing_before_payment_rules;
end if;end$$;
revoke all on function public.cart_pricing_before_payment_rules(text)from public,anon,authenticated;
create or replace function public.cart_pricing(p_promo text default null)returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;restriction text;begin
 result:=public.cart_pricing_before_payment_rules(p_promo);
 select payment_restriction into restriction from public.promo_codes where code=upper(trim(p_promo));
 result:=result||jsonb_build_object('payment_restriction',coalesce(restriction,'any'),'coupon_payment_rules_ready',true);
 if restriction='card_full'then result:=jsonb_set(result,'{split}','false'::jsonb);end if;return result;
end$$;
revoke all on function public.cart_pricing(text)from public,anon;
grant execute on function public.cart_pricing(text)to authenticated;

create or replace function public.discount_banner()returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('name',coalesce(name,'Posebna ponuda'),'code',code,'kind',kind,'value',value,'expires_at',expires_at,'first_order_only',first_order_only,'payment_restriction',payment_restriction)
 from public.promo_codes where banner and active and starts_at<=now()and expires_at>now()
 and(select count(*)from public.promo_code_uses u where u.promo_id=promo_codes.id)<max_uses
 and not exists(select 1 from public.promo_code_uses u where u.promo_id=promo_codes.id and u.user_id=auth.uid())
 and(customer_id is null or customer_id=auth.uid())
 and(not first_order_only or auth.uid()is null or not exists(select 1 from public.orders o where o.user_id=auth.uid()))limit 1$$;
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202611100017','coupon_payment_rules',ARRAY[$source$alter table public.promo_codes add column if not exists payment_restriction text not null default 'any' check(payment_restriction in('any','card_full'));
-- Pravilo vrijedi i ako se POPUST10 kasnije ponovno kreira.
create or replace function public.set_popust10_policy()returns trigger language plpgsql set search_path=public as $$begin
 if upper(trim(new.code))='POPUST10'then new.payment_restriction:='card_full';new.first_order_only:=true;end if;return new;
end$$;
revoke all on function public.set_popust10_policy()from public,anon,authenticated;
drop trigger if exists popust10_policy on public.promo_codes;
create trigger popust10_policy before insert or update on public.promo_codes for each row execute function public.set_popust10_policy();
update public.promo_codes set payment_restriction='card_full',first_order_only=true where upper(trim(code))='POPUST10';

create or replace function public.promo_payment_guard()returns trigger language plpgsql security definer set search_path=public as $$
declare restricted boolean;o public.orders;begin
 select payment_restriction='card_full'into restricted from public.promo_codes where id=new.promo_id for share;
 if restricted then
  select * into o from public.orders where id=new.order_id for update;
  if o.payment_method<>'card'or o.payment_model<>'full'then raise exception 'Ovaj kupon vrijedi samo za jednokratno plaćanje karticom. Ne vrijedi za 50/50 ni IBAN.';end if;
  -- Sačuvano pravilo ne nestaje naknadnim preimenovanjem ili brisanjem kupona.
  update public.orders set checkout_details=checkout_details||'{"coupon_card_full":true}'::jsonb where id=o.id;
 end if;return new;
end$$;
revoke all on function public.promo_payment_guard()from public,anon,authenticated;
drop trigger if exists promo_payment_before_use on public.promo_code_uses;
create trigger promo_payment_before_use before insert on public.promo_code_uses for each row execute function public.promo_payment_guard();

create or replace function public.order_coupon_payment_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 if(new.payment_method is distinct from old.payment_method or new.payment_model is distinct from old.payment_model)and(
 old.checkout_details->>'coupon_card_full'='true'or exists(select 1 from public.promo_code_uses u join public.promo_codes p on p.id=u.promo_id where u.order_id=old.id and p.payment_restriction='card_full'))and(new.payment_method<>'card'or new.payment_model<>'full')then
 raise exception 'Narudžba s ovim kuponom dopušta samo jednokratno plaćanje karticom.';
 end if;return new;
end$$;
revoke all on function public.order_coupon_payment_guard()from public,anon,authenticated;
drop trigger if exists order_coupon_payment on public.orders;
create trigger order_coupon_payment before update of payment_method,payment_model on public.orders for each row execute function public.order_coupon_payment_guard();

-- Sačuvaj izračun i postojeće provjere prve narudžbe, datuma, vlasnika i gostiju.
do $$begin if to_regprocedure('public.cart_pricing_before_payment_rules(text)')is null then
 alter function public.cart_pricing(text)rename to cart_pricing_before_payment_rules;
end if;end$$;
revoke all on function public.cart_pricing_before_payment_rules(text)from public,anon,authenticated;
create or replace function public.cart_pricing(p_promo text default null)returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;restriction text;begin
 result:=public.cart_pricing_before_payment_rules(p_promo);
 select payment_restriction into restriction from public.promo_codes where code=upper(trim(p_promo));
 result:=result||jsonb_build_object('payment_restriction',coalesce(restriction,'any'),'coupon_payment_rules_ready',true);
 if restriction='card_full'then result:=jsonb_set(result,'{split}','false'::jsonb);end if;return result;
end$$;
revoke all on function public.cart_pricing(text)from public,anon;
grant execute on function public.cart_pricing(text)to authenticated;

create or replace function public.discount_banner()returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('name',coalesce(name,'Posebna ponuda'),'code',code,'kind',kind,'value',value,'expires_at',expires_at,'first_order_only',first_order_only,'payment_restriction',payment_restriction)
 from public.promo_codes where banner and active and starts_at<=now()and expires_at>now()
 and(select count(*)from public.promo_code_uses u where u.promo_id=promo_codes.id)<max_uses
 and not exists(select 1 from public.promo_code_uses u where u.promo_id=promo_codes.id and u.user_id=auth.uid())
 and(customer_id is null or customer_id=auth.uid())
 and(not first_order_only or auth.uid()is null or not exists(select 1 from public.orders o where o.user_id=auth.uid()))limit 1$$;
NOTIFY pgrst,'reload schema';
$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'POPUST10 vrijedi samo za prvu narudžbu uz jednokratno kartično plaćanje.'AS rezultat;

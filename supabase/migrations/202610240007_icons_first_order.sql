-- Javne ikone: samo administrator piše u zasebni bucket, bez pristupa datotekama narudžbi.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-icons','payment-icons',true,2097152,array['image/png']);
create policy payment_icons_admin_insert on storage.objects for insert to authenticated
with check(bucket_id='payment-icons'and public.is_admin()and name ~ '^(visa|mastercard|apple_pay|google_pay|keks|aircash)/[a-f0-9-]{36}\.png$');
create policy payment_icons_admin_select on storage.objects for select to authenticated
using(bucket_id='payment-icons'and public.is_admin());
create policy payment_icons_admin_delete on storage.objects for delete to authenticated
using(bucket_id='payment-icons'and public.is_admin());
create function public.set_payment_icon(p_method text,p_url text default null)returns void
language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();
 if p_method not in('visa','mastercard','apple_pay','google_pay','keks','aircash')then raise exception 'Nepoznata metoda';end if;
 if p_url is not null and(p_url !~ '^https://[^[:space:]]+$'or length(p_url)>2000)then raise exception 'Neispravna poveznica ikone';end if;
 update public.site_settings set payment_icons=case when p_url is null then payment_icons-p_method else jsonb_set(payment_icons,array[p_method],to_jsonb(p_url),true)end where id=true;
end$$;
revoke all on function public.set_payment_icon(text,text)from public,anon,authenticated;
grant execute on function public.set_payment_icon(text,text)to authenticated;

alter table public.promo_codes add column first_order_only boolean not null default false;
-- Svako kreiranje narudžbe istog korisnika mora biti serijalizirano, uključujući narudžbe bez kupona.
create function public.serialize_customer_orders()returns trigger language plpgsql security definer set search_path=public as $$begin
 perform pg_advisory_xact_lock(hashtextextended('customer-orders:'||new.user_id::text,0));return new;
end$$;
create trigger serialize_customer_orders before insert on public.orders for each row execute function public.serialize_customer_orders();
create or replace function public.promo_customer_guard()returns trigger language plpgsql security definer set search_path=public as $$declare promo public.promo_codes;begin
 select * into promo from public.promo_codes where id=new.promo_id;
 if promo.customer_id is not null and promo.customer_id<>new.user_id then raise exception 'Kupon nije namijenjen ovom korisniku';end if;
 if promo.first_order_only and exists(select 1 from public.orders where user_id=new.user_id and id<>new.order_id)then
 raise exception 'Kupon vrijedi samo za prvu narudžbu korisnika koji još nikad nije naručio.';end if;
 return new;
end$$;
create or replace function public.discount_banner()returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('name',coalesce(name,'Posebna ponuda'),'code',code,'kind',kind,'value',value,'expires_at',expires_at,'first_order_only',first_order_only)
 from public.promo_codes where banner and active and expires_at>now()
 and(select count(*)from public.promo_code_uses u where u.promo_id=promo_codes.id)<max_uses
 and not exists(select 1 from public.promo_code_uses u where u.promo_id=promo_codes.id and u.user_id=auth.uid())
 and(customer_id is null or customer_id=auth.uid())
 and(not first_order_only or auth.uid()is null or not exists(select 1 from public.orders o where o.user_id=auth.uid()))limit 1$$;
revoke all on function public.serialize_customer_orders(),public.promo_customer_guard()from public,anon,authenticated;
NOTIFY pgrst, 'reload schema';

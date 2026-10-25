-- Jedna košarica, jedna narudžba, jedna naplata po rati.
alter table public.orders
 add column payment_method text not null default 'card' check(payment_method in('card','google_pay','apple_pay','bank')),
 add column checkout_details jsonb not null default '{}'::jsonb,
 add column bank_instructions jsonb,
 add column checkout_request_id uuid,
 add constraint checkout_request_unique unique(user_id,checkout_request_id);

create function public.checkout_options()returns jsonb language plpgsql stable security definer set search_path=public as $$
declare s public.site_settings;b public.business_settings;
begin
 perform public.assert_user();select * into s from public.site_settings where id=true;select * into b from public.business_settings where id=true;
 return jsonb_build_object('card',s.stripe_enabled and not s.maintenance,
 'google_pay',s.stripe_enabled and not s.maintenance and exists(select 1 from public.payment_methods where code='google_pay'and provider='stripe'and enabled and verified),
 'apple_pay',s.stripe_enabled and not s.maintenance and exists(select 1 from public.payment_methods where code='apple_pay'and provider='stripe'and enabled and verified),
 'bank',s.bank_enabled and not s.maintenance and coalesce(trim(b.iban),'')<>''and coalesce(trim(b.payment_recipient),'')<>'');
end$$;

create function public.cart_pricing(p_promo text default null)returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();r record;promo public.promo_codes;subtotal bigint:=0;eligible bigint:=0;discount integer:=0;split_ok boolean:=true;item_count integer:=0;
begin
 for r in select ci.quantity,s.* from public.cart_items ci join public.carts c on c.id=ci.cart_id left join public.services s on s.id=ci.service_id where c.user_id=u order by ci.id loop
  if r.id is null or not r.active or r.price_cents is null then raise exception 'U košarici je nedostupan artikl ili artikl koji zahtijeva individualnu ponudu.';end if;
  item_count:=item_count+1;subtotal:=subtotal+r.price_cents::bigint*r.quantity;
  split_ok:=split_ok and r.split_enabled and r.price_cents::bigint*r.quantity>=r.split_min_cents;
 end loop;
 if item_count=0 then raise exception 'Košarica je prazna';end if;
 if item_count>100 or subtotal>100000000 then raise exception 'Košarica prelazi dopušteni iznos ili broj artikala.';end if;
 if coalesce(trim(p_promo),'')<>''then
  select * into promo from public.promo_codes where code=upper(trim(p_promo));
  if not found or not promo.active or promo.expires_at<=now()or(promo.customer_id is not null and promo.customer_id<>u)then raise exception 'Kupon nije primjenjiv';end if;
  if exists(select 1 from public.promo_code_uses where promo_id=promo.id and user_id=u)or(select count(*)from public.promo_code_uses where promo_id=promo.id)>=promo.max_uses then raise exception 'Kupon je iskorišten';end if;
  if promo.first_order_only and exists(select 1 from public.orders where user_id=u)then raise exception 'Kupon vrijedi samo za prvu narudžbu korisnika koji još nikad nije naručio.';end if;
  select coalesce(sum(s.price_cents::bigint*ci.quantity),0)into eligible from public.cart_items ci join public.carts c on c.id=ci.cart_id join public.services s on s.id=ci.service_id where c.user_id=u and(promo.service_id is null or promo.service_id=s.id);
  if eligible=0 then raise exception 'Kupon ne vrijedi za odabrane artikle';end if;
  discount:=least(eligible,case when promo.kind='fixed'then promo.value else floor(eligible::numeric*promo.value/100)::int end);
 end if;
 if subtotal-discount<100 then raise exception 'Najmanji iznos nakon popusta je 1 EUR';end if;
 return jsonb_build_object('subtotal',subtotal,'discount',discount,'total',subtotal-discount,'split',split_ok and subtotal-discount>=200,'count',item_count);
end$$;

create function public.checkout_cart_order(p_request uuid,p_title text,p_description text,p_due timestamptz,p_method text,p_model text,p_details jsonb default '{}',p_promo text default null)returns uuid
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
 insert into public.order_items(order_id,service_id,name,quantity,unit_cents)select oid,s.id,s.name,ci.quantity,s.price_cents from public.cart_items ci join public.services s on s.id=ci.service_id where ci.cart_id=c;
 insert into public.payment_installments(order_id,installment,amount_cents)values(oid,1,case when p_model='split'then(total+1)/2 else total end);
 if p_model='split'then insert into public.payment_installments(order_id,installment,amount_cents)values(oid,2,total/2);end if;
 if promo_id is not null then insert into public.promo_code_uses(promo_id,user_id,order_id)values(promo_id,u,oid);end if;
 delete from public.cart_items where cart_id=c;
 return oid;
end$$;

create function public.confirm_bank_payment(p_order uuid,p_amount integer,p_reference text)returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders;i public.payment_installments;p public.payments;pid uuid;reference text;paid integer;a integer;
begin
 perform public.assert_admin();reference:='bank:'||trim(p_reference);
 if p_reference is null or length(trim(p_reference))not between 6 and 150 then raise exception 'Unesite jedinstvenu referencu transakcije s bankovnog izvoda (6–150 znakova)';end if;
 select * into o from public.orders where id=p_order for update;
 if not found or o.payment_method<>'bank'then raise exception 'Narudžba nije za IBAN uplatu';end if;
 select * into p from public.payments where provider_payment_id=reference;
 if found then if p.order_id=p_order and p.amount_cents=p_amount and p.status='succeeded'then return p.id;end if;raise exception 'Ova bankovna transakcija već je evidentirana';end if;
 if o.status not in('deposit_pending','final_pending')then raise exception 'Narudžba trenutačno ne očekuje uplatu';end if;
 select * into i from public.payment_installments where order_id=o.id and installment=case when o.status='final_pending'then 2 else 1 end;
 if not found or p_amount is distinct from i.amount_cents then raise exception 'Iznos mora odgovarati cijelom iznosu trenutačne rate';end if;
 if exists(select 1 from public.payments where order_id=o.id and installment=i.installment and status in('pending','succeeded','refunded','partially_refunded'))then raise exception 'Uplata za ovu ratu već postoji';end if;
 select coalesce(max(attempt),0)+1 into a from public.payments where order_id=o.id and installment=i.installment;
 insert into public.payments(order_id,installment,amount_cents,provider,status,provider_payment_id,attempt)values(o.id,i.installment,p_amount,'bank','succeeded',reference,a)returning id into pid;
 select coalesce(sum(amount_cents-refunded_cents),0)into paid from public.payments where order_id=o.id and status in('succeeded','refunded','partially_refunded');
 update public.orders set paid_cents=paid,status=case when status='deposit_pending'then 'ready'::public.order_state when status='final_pending'and paid>=total_cents then 'delivered'::public.order_state else status end where id=o.id;
 insert into public.audit_logs(actor_id,action,entity_id,details)values(auth.uid(),'bank_payment.confirmed',pid::text,jsonb_build_object('order_id',o.id,'amount_cents',p_amount,'reference',trim(p_reference)));
 return pid;
end$$;
revoke all on function public.checkout_options(),public.cart_pricing(text),public.checkout_cart_order(uuid,text,text,timestamptz,text,text,jsonb,text),public.confirm_bank_payment(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.checkout_options(),public.cart_pricing(text),public.checkout_cart_order(uuid,text,text,timestamptz,text,text,jsonb,text),public.confirm_bank_payment(uuid,integer,text) to authenticated;

-- Stripe ne smije rezervirati uplatu za IBAN narudžbu.
create or replace function public.reserve_payment(p_order uuid,p_user uuid)returns public.payments language plpgsql security definer set search_path=public as $$declare o public.orders;p public.payments;i public.payment_installments;a integer;begin if not exists(select 1 from public.site_settings where stripe_enabled and not maintenance)then raise exception 'Plaćanje nije aktivirano';end if;select * into o from public.orders where id=p_order and user_id=p_user for update;if not found or o.total_cents is null then raise exception 'Narudžba nije dostupna za plaćanje';end if;if o.payment_method='bank'then raise exception 'Za ovu narudžbu odabrana je IBAN uplata';end if;if o.status not in('deposit_pending','final_pending')then raise exception 'Uplata trenutačno nije potrebna';end if;select * into i from public.payment_installments where order_id=o.id and installment=case when o.status='final_pending'then 2 else 1 end;if not found or i.amount_cents<1 then raise exception 'Plan plaćanja ne postoji';end if;select * into p from public.payments where order_id=o.id and installment=i.installment and status in('pending','succeeded','partially_refunded','refunded');if found then if p.status<>'pending'then raise exception 'Uplata je već obrađena';end if;return p;end if;select coalesce(max(attempt),0)+1 into a from public.payments where order_id=o.id and installment=i.installment;insert into public.payments(order_id,installment,amount_cents,attempt)values(o.id,i.installment,i.amount_cents,a)returning * into p;return p;end$$;

create or replace function public.admin_delete_service(p_service uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_admin();
  perform 1 from public.services where id=p_service for update;
  if not found then raise exception 'Artikl nije pronađen. Osvježite katalog.'; end if;
  delete from public.cart_items where service_id=p_service;
  delete from public.service_variants where service_id=p_service;
  delete from public.service_option_values where option_id in(select id from public.service_options where service_id=p_service);
  delete from public.service_options where service_id=p_service;
  update public.order_items set service_id=null where service_id=p_service;
  update public.service_price_history set service_id=null where service_id=p_service;
  -- Kupon za izbrisani artikl ne smije postati aktivan za cijeli katalog.
  update public.promo_codes set active=false, service_id=null where service_id=p_service;
  delete from public.services where id=p_service;
end $$;

NOTIFY pgrst, 'reload schema';

create function public.cart_add(p_service uuid,p_quantity integer default 1)returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();c uuid;n integer;
begin
 if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Neispravna količina';end if;
 insert into public.carts(user_id)values(u)on conflict(user_id)do update set user_id=excluded.user_id returning id into c;
 select coalesce((select quantity from public.cart_items where cart_id=c and service_id=p_service),0)+p_quantity into n;
 if n>100 then raise exception 'Najviše 100 komada po artiklu';end if;
 perform public.cart_set(p_service,n);
end$$;
create function public.cart_clear()returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();c uuid;
begin select id into c from public.carts where user_id=u for update;delete from public.cart_items where cart_id=c;end$$;
revoke all on function public.cart_add(uuid,integer),public.cart_clear()from public,anon,authenticated;
grant execute on function public.cart_add(uuid,integer),public.cart_clear()to authenticated;
NOTIFY pgrst, 'reload schema';

-- Omogućuje odabir IBAN-a i za prihvaćene individualne ponude, prije početka naplate.
create function public.choose_order_payment(p_order uuid,p_method text)returns void language plpgsql security definer set search_path=public as $$
declare u uuid:=public.assert_user();o public.orders;b public.business_settings;options jsonb;
begin
 select * into o from public.orders where id=p_order and user_id=u for update;
 if not found or o.status<>'deposit_pending'or o.paid_cents<>0 then raise exception 'Način plaćanja sada se ne može promijeniti';end if;
 if p_method=o.payment_method then return;end if;
 if p_method is null or p_method not in('card','bank','google_pay','apple_pay')or(o.payment_model='split'and p_method in('google_pay','apple_pay'))then raise exception 'Neispravan način plaćanja';end if;
 if exists(select 1 from public.payments where order_id=o.id and status in('pending','succeeded','partially_refunded','refunded'))then raise exception 'Naplata je već pokrenuta. Prvo zatvorite postojeći pokušaj naplate.';end if;
 if p_method='bank'then select * into b from public.business_settings where id=true for share;end if;
 options:=public.checkout_options();if not coalesce((options->>p_method)::boolean,false)then raise exception 'Način plaćanja nije dostupan';end if;
 update public.orders set payment_method=p_method,bank_instructions=case when p_method='bank'then jsonb_build_object('recipient',b.payment_recipient,'iban',b.iban,'bank',b.bank_name)end where id=o.id;
end$$;
revoke all on function public.choose_order_payment(uuid,text)from public,anon,authenticated;
grant execute on function public.choose_order_payment(uuid,text)to authenticated;
NOTIFY pgrst, 'reload schema';

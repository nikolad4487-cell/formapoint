reset role;
insert into auth.users(id,is_anonymous)values('a6000000-0000-4000-8000-000000000001',true),('a6000000-0000-4000-8000-000000000002',true);
insert into public.service_categories(name,slug)values('Gost test','gost-test');
insert into public.services(name,slug,description,category,price_cents,split_enabled,split_min_cents)values('Artikl za gosta','guest-item','Test kupnje bez računa','Gost test',2000,true,200)returning id as guest_service \gset
insert into public.promo_codes(code,kind,value,max_uses,expires_at,first_order_only)values('GUESTFIRST','percent',10,10,now()+interval'1 day',true);
update public.site_settings set bank_enabled=true,maintenance=false;
update public.business_settings set iban='HR1210010051863000160',payment_recipient='Testni primatelj';
set role authenticated;select set_config('request.jwt.claim.sub','a6000000-0000-4000-8000-000000000001',false);
select public.cart_add(:'guest_service',1);
select pg_temp.expect_error('select public.checkout_cart_order(gen_random_uuid(),''Gost narudžba'',''Detaljne upute za gosta'',now()+interval''2 day'',''bank'',''split'',''{"course":"Dokumenti"}'',null)','Gost bez kontakta ne može stvoriti narudžbu');
select pg_temp.expect_error('select public.save_guest_contact(''Ana'',''Gost'',''ana@example.invalid'',false)','Gost mora prihvatiti uvjete');
select pg_temp.expect_error('select public.save_guest_contact(''Ana'',''Gost'',''nije-email'',true)','Kontaktni e-mail provjerava poslužitelj');
select public.save_guest_contact('Ana','Gost','ANA@example.invalid',true);
select public.checkout_cart_order(gen_random_uuid(),'Gost narudžba','Detaljne upute za gosta',now()+interval'2 day','bank','split','{"course":"Dokumenti"}','GUESTFIRST')as guest_order \gset
select pg_temp.assert_true((select checkout_details->>'guest_email'='ana@example.invalid' and checkout_details->>'guest_name'='Ana Gost' and total_cents=1800 and paid_cents=0 from public.orders where id=:'guest_order'),'Gost naručuje uz kontaktni snapshot i popust, bez lažne uplate');
select pg_temp.assert_true((select count(*)=2 from public.payment_installments where order_id=:'guest_order'),'Gost koristi postojeće dvije rate');
select set_config('request.jwt.claim.sub','a6000000-0000-4000-8000-000000000002',false);
select pg_temp.assert_true(not exists(select 1 from public.orders where id=:'guest_order'),'Druga gostujuća sesija ne čita tuđu narudžbu');
select pg_temp.expect_error('select public.checkout_contact_email(''a6000000-0000-4000-8000-000000000001'')','Gost ne može dohvaćati privatne e-mail adrese');
select public.save_guest_contact('Ana','Gost','ana@example.invalid',true);
select public.cart_add(:'guest_service',1);
select pg_temp.expect_error('select public.cart_pricing(''GUESTFIRST'')','Nova gostujuća sesija s istim e-mailom ne dobiva popust za prvu kupnju');
select pg_temp.expect_error('select public.cart_pricing_before_guest(''GUESTFIRST'')','Zaštita kupona ne može se zaobići starom funkcijom');
select public.checkout_cart_order(gen_random_uuid(),'Druga gost narudžba','Detaljne upute za gosta',now()+interval'2 day','bank','full','{"course":"Dokumenti"}',null)as guest_order_full \gset
select pg_temp.assert_true((select count(*)=1 from public.payment_installments where order_id=:'guest_order_full'),'Gost može odabrati jednokratno plaćanje');
reset role;set role anon;
select pg_temp.expect_error('select public.save_guest_contact(''A'',''B'',''a@example.invalid'',true)','Neautentificirani klijent nema pristup kontaktima');
reset role;

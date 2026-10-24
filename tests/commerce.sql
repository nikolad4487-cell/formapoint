reset role;
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.set_payment_icon('visa','https://example.invalid/visa.png');
select public.set_payment_icon('mastercard','https://example.invalid/mastercard.png');
select pg_temp.assert_true((select payment_icons->>'visa'='https://example.invalid/visa.png'and payment_icons->>'mastercard'='https://example.invalid/mastercard.png'from public.site_settings),'Neovisno učitavanje ikona čuva ostale metode');
select public.set_payment_icon('visa',null);
select pg_temp.assert_true((select not(payment_icons?'visa')and payment_icons?'mastercard'from public.site_settings),'Uklanjanje ikone ne briše ostale metode');
select pg_temp.expect_error('select public.set_payment_icon(''fake'',''https://example.invalid/icon.png'')','Nepoznata platna metoda odbijena');
select pg_temp.expect_error('select public.set_payment_icon(''visa'',''javascript:alert(1)'')','Ikone ne prihvaćaju opasne poveznice');
insert into storage.objects(bucket_id,name)values('payment-icons','visa/11111111-1111-4111-8111-111111111111.png');
select pg_temp.assert_true((select count(*)=1 from storage.objects),'Admin može učitati ikonu u namjenski bucket');
select pg_temp.expect_error('insert into storage.objects(bucket_id,name)values(''payment-icons'',''visa/evil.svg'')','Putanja ikone ograničena je na pripremljeni PNG');
select pg_temp.expect_error('insert into storage.objects(bucket_id,name)values(''order-files'',''visa/11111111-1111-4111-8111-111111111111.png'')','Nova pravila ne otvaraju privatne datoteke narudžbi');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.expect_error('select public.set_payment_icon(''visa'',null)','Korisnik ne uređuje ikone platforme');
select pg_temp.expect_error('insert into storage.objects(bucket_id,name)values(''payment-icons'',''visa/22222222-2222-4222-8222-222222222222.png'')','Korisnik ne učitava javne ikone');
delete from storage.objects where bucket_id='payment-icons';
reset role;select pg_temp.assert_true((select count(*)=1 from storage.objects),'Korisnik ne briše administratorske ikone');
select pg_temp.assert_true((select public and file_size_limit=2097152 and allowed_mime_types=array['image/png']from storage.buckets where id='payment-icons'),'Bucket ograničava veličinu i vrstu javnih slika');
insert into auth.users(id)values('44444444-4444-4444-8444-444444444444'),('55555555-5555-4555-8555-555555555555'),('66666666-6666-4666-8666-666666666666'),('77777777-7777-4777-8777-777777777777');
insert into public.promo_codes(code,kind,value,max_uses,expires_at,first_order_only)values('FIRSTA','percent',20,20,now()+interval'1 day',true),('FIRSTB','percent',20,20,now()+interval'1 day',true),('GENERAL','percent',10,20,now()+interval'1 day',false);
select id as commerce_service from public.services where slug='excel' \gset
set role authenticated;select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
select public.create_order(:'commerce_service',1,'Prva narudžba','Prvi zadatak novog korisnika',null,'full','FIRSTA')as first_order \gset
select pg_temp.assert_true((select total_cents=7200 from public.orders where id=:'first_order'),'Korisnik bez narudžbi dobiva popust za prvu narudžbu');
select pg_temp.expect_error(format('select public.create_order(%L,1,''Druga narudžba'',''Pokušaj drugog koda za nove korisnike'',null,''full'',''FIRSTB'')',:'commerce_service'),'Drugi različiti kod za prvu narudžbu se odbija');
select pg_temp.assert_true((select count(*)=1 from public.orders),'Odbijanje kupona ne stvara dodatnu narudžbu');
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
select public.create_order(:'commerce_service',1,'Prethodna narudžba','Obična prva narudžba bez kupona',null,'full',null)as cancelled_order \gset
reset role;update public.orders set status='cancelled'where id=:'cancelled_order';
set role authenticated;select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
select pg_temp.expect_error(format('select public.create_order(%L,1,''Novi pokušaj'',''Otkazana prethodna narudžba i dalje se računa'',null,''full'',''FIRSTA'')',:'commerce_service'),'Otkazana narudžba također isključuje popust za nove korisnike');
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
select public.create_order(:'quote_service',1,'Zahtjev za ponudu','Korisnik je već zatražio individualnu ponudu');
select pg_temp.expect_error(format('select public.create_order(%L,1,''Nova narudžba'',''Postoji prethodni zahtjev za ponudu'',null,''full'',''FIRSTA'')',:'commerce_service'),'Raniji zahtjev za ponudu također se računa kao narudžba');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_order(:'commerce_service',1,'Postojeći kupac','Obični kupon ostaje dostupan postojećim korisnicima',null,'full','GENERAL')as general_order \gset
select pg_temp.assert_true((select total_cents=8100 from public.orders where id=:'general_order'),'Obični kuponi i dalje rade za postojeće kupce');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select id as first_promo from public.promo_codes where code='FIRSTB' \gset
select public.set_discount_banner(:'first_promo',true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.assert_true(public.discount_banner()is null,'Banner prvog popusta skriven je od postojećeg kupca');
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',false);
select pg_temp.assert_true((public.discount_banner()->>'first_order_only')::boolean,'Novi kupac vidi uvjet prve narudžbe na banneru');
reset role;

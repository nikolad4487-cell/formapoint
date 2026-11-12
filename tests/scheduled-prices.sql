reset role;
insert into auth.users(id,email,email_confirmed_at)values('b2000000-0000-4000-8000-000000000001','scheduled-price@example.invalid',now());
insert into public.services(name,slug,description,category,price_cents,split_enabled,split_min_cents)values('Planirana cijena test','planirana-cijena','Opis planirane cijene','Checkout test',1000,true,200)returning id as scheduled_service \gset
set role authenticated;select set_config('request.jwt.claim.sub','b2000000-0000-4000-8000-000000000001',false);
select public.create_order(:'scheduled_service',1,'Stara narudžba','Opis stare narudžbe prije promjene',null,'full',null)as old_price_order \gset
select pg_temp.expect_error(format('select public.schedule_service_price(%L,2000,now()+interval''40 day'')',:'scheduled_service'),'Kupac ne može zakazati cijenu');
select pg_temp.expect_error('select public.price_schedule_health()','Kupac ne vidi privatni raspored budućih cijena');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.schedule_service_price(:'scheduled_service',2000,now()+interval'40 day','Test buduće cijene')as scheduled_change \gset
select pg_temp.expect_error(format('select public.schedule_service_price(%L,50,now()+interval''40 day'')',:'scheduled_service'),'Nova cijena mora biti najmanje 1 EUR');
select pg_temp.expect_error(format('select public.schedule_service_price(%L,2000,now()-interval''1 day'')',:'scheduled_service'),'Administrator ne može potajno zadati cijenu u prošlosti');
reset role;select set_config('request.jwt.claim.sub','',false);set role anon;
select pg_temp.expect_error('select * from public.service_price_schedules','Buduće cijene nisu javna tablica');
select pg_temp.expect_error('select public.apply_due_service_prices()','Interna funkcija nije izložena posjetitelju');
select pg_temp.assert_true(public.refresh_service_prices()=0,'Posjetitelj ne može primijeniti buduće cijene prije datuma');
reset role;
select pg_temp.assert_true((select price_cents=1000 from public.services where id=:'scheduled_service'),'Do početka vrijedi stara cijena');
select pg_temp.assert_true('2027-01-01 00:00:00 Europe/Zagreb'::timestamptz='2026-12-31 23:00:00+00'::timestamptz,'Početak cjenika računa se po hrvatskom vremenu');
-- Simulacija dolaska roka bez izmjene sistemskog sata ili budućeg datuma u javnom RPC-u.
update public.service_price_schedules set starts_at=now()-interval'1 minute'where id=:'scheduled_change';
set role authenticated;select set_config('request.jwt.claim.sub','b2000000-0000-4000-8000-000000000001',false);
select public.cart_add(:'scheduled_service',1);
select public.checkout_cart_order(gen_random_uuid(),'Nova cijena checkout','Detaljne upute za novu cijenu',now()+interval'2 day','card','full','{"course":"Dokumenti"}',null)as new_price_order \gset
select pg_temp.assert_true((select total_cents=2000 from public.orders where id=:'new_price_order'),'Potvrda narudžbe primjenjuje dospjelu cijenu i bez prethodnog cron poziva');
select pg_temp.assert_true((select total_cents=1000 from public.orders where id=:'old_price_order'),'Stara narudžba zadržava ugovoreni iznos');
reset role;
select pg_temp.assert_true((select status='applied'and old_price_cents=1000 and applied_at is not null from public.service_price_schedules where id=:'scheduled_change'),'Promjena ima evidenciju primjene i prethodnu cijenu');
select pg_temp.assert_true(public.refresh_service_prices()=0 and public.refresh_service_prices()=0,'Ponovljeni poziv ne primjenjuje istu promjenu više puta');
select pg_temp.assert_true((select count(*)=1 from public.service_price_history where service_id=:'scheduled_service'),'Automatska promjena čuva povijest cijene bez duplikata');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.schedule_service_price(:'scheduled_service',3000,now()+interval'41 day','Otkazivanje')as cancel_change \gset
select public.cancel_service_price(:'cancel_change');
reset role;update public.service_price_schedules set starts_at=now()-interval'1 minute'where id=:'cancel_change';
select pg_temp.assert_true(public.refresh_service_prices()=0 and(select price_cents=2000 from public.services where id=:'scheduled_service'),'Otkazana promjena ne mijenja cijenu ni nakon roka');
-- Usluga koja prije roka prijeđe na pakete traži provjeru, umjesto promjene cijena paketa.
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.schedule_service_price(:'scheduled_service',4000,now()+interval'42 day','Promjena na pakete')as package_price_change \gset
select public.save_service_packages(:'scheduled_service',true,'[{"name":"Paket","price_cents":7000}]');
reset role;update public.service_price_schedules set starts_at=now()-interval'2 minute'where id=:'package_price_change';
select pg_temp.assert_true(public.refresh_service_prices()=0,'Raspored osnovnih cijena ne prepisuje cijene paketa');
select pg_temp.assert_true((select status='skipped'and last_error is not null from public.service_price_schedules where id=:'package_price_change'),'Promjena na pakete prikazuje da je potrebna provjera');
-- Provjera stvarnog odobrenog popisa na izoliranim kopijama produkcijskih ID-jeva.
insert into public.service_categories(name,slug)values('Učenički radovi - osnovna i srednja škola','ucenicki-2027')on conflict(name)do nothing;
insert into public.services(id,name,slug,description,category,price_cents)select id::uuid,name,slug,'Testna kopija cjenika','Checkout test',7777 from(values
 ('95d76eb9-11a1-4ab0-a1a7-a5cb133dc002','Završni rad - izrada','2027-zavrsni'),
 ('e5bd9877-b653-4aaa-9b1d-9050a057db5f','Uređenje završnog rada','2027-uredenje'),
 ('ee882470-25af-4711-85b9-1ad9070d84fa','Izrada PowerPoint prezentacije završnog rada','2027-ppt-zavrsni'),
 ('bcfb0551-2dcc-4078-9fac-03e318bed22d','Izrada PowerPoint prezentacije','2027-ppt'),
 ('aa8920d3-5901-4b01-9cf0-f77dcaeb1486','Pisanje životopisa','2027-cv'),
 ('2fe7aa46-f1a2-4a1d-9b93-a0117c5d1d23','Pisanje eseja','2027-esej'),
 ('7c96d11f-f001-4597-8f1b-d0982c77493e','Pisanje referata','2027-referat'),
 ('07350119-2724-463d-b241-40f674caccf0','Prepisivanje bilješki u dokument','2027-biljeske'),
 ('19223dab-a88d-4c35-a9a4-2bd1976bf3a2','Pisanje sastavka','2027-sastavak'),
 ('0433f0e6-54ee-44fd-bbc2-842f492764c4','Online administracija','2027-admin'),
 ('958b7acd-8f18-4a93-a723-406c294cefa2','Upravljanje i vođenje e-pošte','2027-email')
 )v(id,name,slug);
delete from supabase_migrations.schema_migrations where version='202611120020';
-- REAPPLY_OWNER_PRICE_SEED
insert into supabase_migrations.schema_migrations(version,name)values('202611120020','scheduled_prices');
-- REAPPLY_OWNER_PRICE_SEED
select pg_temp.assert_true((select count(*)=10 from public.service_price_schedules where note like'%cjenik od 1.1.2027.%'or note like'Cjenik od 1.1.2027.%'),'Cjenik vlasnika stvara deset zakazanih cijena i sigurno se ponavlja');
select pg_temp.assert_true((select new_price_cents=8000 from public.service_price_schedules where service_id='95d76eb9-11a1-4ab0-a1a7-a5cb133dc002'),'Izrada završnog rada zakazana je na 80 EUR');
select pg_temp.assert_true((select new_price_cents=2000 from public.service_price_schedules where service_id='7c96d11f-f001-4597-8f1b-d0982c77493e'),'Referat je zakazan na 20 EUR');
select pg_temp.assert_true(not exists(select 1 from public.service_price_schedules where service_id in('0433f0e6-54ee-44fd-bbc2-842f492764c4','958b7acd-8f18-4a93-a723-406c294cefa2')),'Online administracija i e-pošta ostaju izvan promjene cijena');
select pg_temp.assert_true((select not active and price_cents is null from public.services where slug='seminar'),'Novi seminar ostaje neobjavljen i bez današnje fiksne cijene');
select pg_temp.assert_true((select new_price_cents=3000 from public.service_price_schedules p join public.services s on s.id=p.service_id where s.slug='seminar'),'Novi seminar dobiva buduću cijenu 30 EUR');
select pg_temp.assert_true((select bool_and(price_cents=7777)from public.services where slug like'2027-%'),'Priprema cjenika ne mijenja današnje cijene');

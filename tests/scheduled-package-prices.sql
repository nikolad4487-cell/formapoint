reset role;
select pg_temp.assert_true((select count(*)=2 and sum(jsonb_array_length(package_plan))=5 from public.service_price_schedules where package_plan is not null),'Nadogradnja 021 zakazuje točno pet paketa za dvije usluge, i nakon ponavljanja');
select pg_temp.assert_true((select bool_and(starts_at='2026-12-31T23:00:00Z'::timestamptz and status='pending')from public.service_price_schedules where package_plan is not null),'Paketi imaju budući početak prema vremenu Hrvatske');
select pg_temp.assert_true((select bool_and(price_cents=7777 and not packages_enabled)from public.services where id in('0433f0e6-54ee-44fd-bbc2-842f492764c4','958b7acd-8f18-4a93-a723-406c294cefa2')),'Priprema novih paketa ne uključuje pakete ili mijenja današnje cijene');
select pg_temp.assert_true(not exists(select 1 from public.service_variants where id::text like'20270101-%'),'Paketi još nisu objavljeni ni dostupni za kupnju');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select pg_temp.expect_error('select public.schedule_service_price(''958b7acd-8f18-4a93-a723-406c294cefa2'',100,''2027-01-01 00:00:00 Europe/Zagreb''::timestamptz)','Obična promjena cijene ne može potajno zamijeniti zakazani cjenik paketa');
reset role;
insert into auth.users(id,email,email_confirmed_at)values('b2100000-0000-4000-8000-000000000001','scheduled-packages@example.invalid',now());
set role authenticated;select set_config('request.jwt.claim.sub','b2100000-0000-4000-8000-000000000001',false);
select public.create_order('958b7acd-8f18-4a93-a723-406c294cefa2',1,'Stara narudžba e-pošte','Opis prije aktivacije novih paketa',null,'full',null)as old_package_price_order \gset
reset role;select set_config('request.jwt.claim.sub','',false);set role anon;
select pg_temp.expect_error('select package_plan from public.service_price_schedules','Cjenik u rasporedu nije izravno javna tablica');
select pg_temp.assert_true(public.refresh_service_prices()=0,'Posjetitelj ne uključuje pakete prije početka valjanosti');
reset role;
update public.service_price_schedules set starts_at=now()-interval'1 minute'where package_plan is not null;
set role anon;select pg_temp.assert_true(public.refresh_service_prices()=2,'Javni dohvat primjenjuje dva dospjela cjenika bez parametara za cijenu ili datum');
select pg_temp.assert_true((select count(*)=5 from public.service_variants where id::text like'20270101-%'),'Nakon roka svih pet aktivnih paketa je javno dostupno');
reset role;
select pg_temp.assert_true((select array_agg(price_cents order by sort_order)=array[7000,9000,35000]from public.service_variants where service_id='958b7acd-8f18-4a93-a723-406c294cefa2'),'E-pošta ima cijene 70, 90 i 350 EUR');
select pg_temp.assert_true((select array_agg(price_cents order by sort_order)=array[30000,130000]from public.service_variants where service_id='0433f0e6-54ee-44fd-bbc2-842f492764c4'),'Administracija ima tjedni paket 300 EUR i mjesečni 1300 EUR');
select pg_temp.assert_true((select bool_and(description like'%fiksnu cijenu neovisno o broju radnih dana%'and description like'%Blagdani%prema dogovoru%')from public.service_variants where id::text like'20270101-%'and period='month'),'Mjesečni paketi imaju dogovorene uvjete o fiksnoj cijeni i blagdanima');
select pg_temp.assert_true((select total_cents=7777 from public.orders where id=:'old_package_price_order'),'Stara narudžba zadržava prvotno ugovoreni iznos');
select pg_temp.assert_true(public.refresh_service_prices()=0 and(select count(*)=5 from public.service_variants where id::text like'20270101-%'),'Ponavljanje primjene ne duplicira pakete');
set role authenticated;select set_config('request.jwt.claim.sub','b2100000-0000-4000-8000-000000000001',false);
select public.cart_add_variant('0433f0e6-54ee-44fd-bbc2-842f492764c4','20270101-0009-4000-8000-000000000001',1);
select pg_temp.assert_true((public.cart_pricing(null)->>'total')::integer=130000,'Košarica koristi cijenu mjesečnog paketa 1300 EUR');
select public.checkout_cart_order(gen_random_uuid(),'Mjesečna administracija','Detaljne upute za mjesečni paket',now()+interval'32 days','card','full','{"course":"Administracija"}',null)as fixed_month_order \gset
select pg_temp.assert_true((select total_cents=130000 from public.orders where id=:'fixed_month_order'),'Mjesečna cijena ne preračunava se po broju radnih dana');
select pg_temp.assert_true((select variant_period='month'and unit_cents=130000 and variant_description like'%Blagdani%'from public.order_items where order_id=:'fixed_month_order'),'Narudžba čuva cijenu, razdoblje i dogovorene uvjete paketa');
reset role;
-- A malformed plan must roll back all its partial writes and leave other due plans working.
insert into public.services(name,slug,description,category,price_cents)values('Neispravni plan test','bad-package-plan','Opis za provjeru atomarnosti plana','Checkout test',1000)returning id as bad_plan_service \gset
insert into public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at,package_plan)values(:'bad_plan_service','Neispravni plan test','Checkout test',100,now()-interval'2 minutes','[{"id":"b2100000-0000-4000-8000-000000000010","name":"Prvi paket","price_cents":100,"period":"week"},{"id":"20270101-0007-4000-8000-000000000001","name":"Tuđi paket","price_cents":100,"period":"week"}]');
insert into public.service_price_schedules(service_id,service_name,category_name,new_price_cents,starts_at)values(:'bad_plan_service','Neispravni plan test','Checkout test',2000,now()-interval'1 minute');
select pg_temp.assert_true(public.refresh_service_prices()=1,'Pogrešan plan ne blokira drugu dospjelu promjenu');
select pg_temp.assert_true(not exists(select 1 from public.service_variants where id='b2100000-0000-4000-8000-000000000010'),'Neuspjela primjena ne ostavlja djelomično kreirane pakete');
select pg_temp.assert_true((select price_cents=2000 and not packages_enabled from public.services where id=:'bad_plan_service'),'Neispravan plan ne uključuje paketni način kupnje');
select pg_temp.assert_true((select status='skipped'and last_error is not null from public.service_price_schedules where service_id=:'bad_plan_service'and package_plan is not null),'Administrator vidi da neispravan plan zahtijeva provjeru');

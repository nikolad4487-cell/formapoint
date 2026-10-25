reset role;
insert into public.service_categories(name,slug)values('Brisanje test','brisanje-test')returning id as delete_category \gset
insert into public.services(name,slug,description,category,price_cents)values('Novi artikl za brisanje','brisanje-test','Opis artikla','Brisanje test',2000)returning id as delete_service \gset
update public.services set price_cents=2500 where id=:'delete_service';
insert into public.service_variants(service_id,name,price_cents)values(:'delete_service','Varijanta',3000);
insert into public.service_options(service_id,name)values(:'delete_service','Opcija');
insert into public.promo_codes(code,kind,value,max_uses,expires_at,service_id)values('DELETEITEM','percent',5,10,now()+interval'1 day',:'delete_service');
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_order(:'delete_service',1,'Narudžba sa sačuvanim artiklom','Opis prije brisanja artikla',null,'full',null)as delete_order \gset
select public.cart_set(:'delete_service',1);
select pg_temp.expect_error(format('select public.admin_delete_service(%L)',:'delete_service'),'Kupac ne može brisati artikle');
select pg_temp.expect_error(format('select public.admin_delete_category(%L)',:'delete_category'),'Kupac ne može brisati kategorije');
reset role;set role anon;
select pg_temp.expect_error(format('select public.admin_delete_service(%L)',:'delete_service'),'Anonimni posjetitelj ne može brisati artikle');
reset role;set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select pg_temp.expect_error(format('select public.admin_delete_category(%L)',:'delete_category'),'Neprazna kategorija ne briše artikle');
select public.admin_delete_service(:'delete_service');
select pg_temp.assert_true(not exists(select 1 from public.services where id=:'delete_service'),'Admin briše novi artikl povezan s narudžbom i košaricom');
select pg_temp.assert_true((select service_id is null and name='Novi artikl za brisanje'and quantity=1 and unit_cents=2500 from public.order_items where order_id=:'delete_order'),'Naziv, količina i cijena stare stavke ostaju sačuvani');
select pg_temp.assert_true((select total_cents=2500 and paid_cents=0 and status='deposit_pending' from public.orders where id=:'delete_order'),'Brisanje ne mijenja narudžbu ni uplate');
select pg_temp.assert_true((select amount_cents=2500 from public.payment_installments where order_id=:'delete_order'),'Brisanje ne mijenja ugovorene rate');
select pg_temp.assert_true((select not active and service_id is null from public.promo_codes where code='DELETEITEM'),'Kupon za izbrisani artikl deaktivira se');
select pg_temp.expect_error(format('select public.admin_delete_service(%L)',:'delete_service'),'Ponovljeno brisanje vraća jasnu grešku');
select public.admin_delete_category(:'delete_category');
select pg_temp.assert_true(not exists(select 1 from public.service_categories where id=:'delete_category'),'Admin briše praznu novu kategoriju');
select id as seeded_delete from public.services where slug='e-posta' \gset
select public.admin_delete_service(:'seeded_delete');
select pg_temp.assert_true(not exists(select 1 from public.services where id=:'seeded_delete'),'Admin briše i početne artikle');
reset role;
select pg_temp.assert_true(not exists(select 1 from public.cart_items where service_id=:'delete_service'),'Artikl je uklonjen iz svih košarica');
select pg_temp.assert_true(not exists(select 1 from public.service_variants where service_id=:'delete_service')and not exists(select 1 from public.service_options where service_id=:'delete_service'),'Varijante i opcije izbrisanog artikla uklonjene su');
select pg_temp.assert_true(exists(select 1 from public.service_price_history where service_id is null and new_cents=2500),'Povijest cijena ostaje sačuvana');
select pg_temp.assert_true(exists(select 1 from public.audit_logs where action='services.DELETE'and entity_id=:'delete_service'),'Brisanje ostaje zapisano u auditu');

reset role;
select pg_temp.assert_true((select count(*)=2 and bool_and(code in('visa','mastercard'))from public.payment_methods where provider='stripe'),'Početni popis sadrži samo Visa i Mastercard');
select pg_temp.assert_true((select icon_url='https://example.invalid/previous-visa.png'from public.payment_methods where code='visa'),'Migracija čuva prethodno učitanu ikonu kartice');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
insert into public.payment_methods(code,name,provider)values('apple_pay','Apple Pay','stripe')returning id as apple_id \gset
select pg_temp.expect_error(format('update public.payment_methods set enabled=true where id=%L',:'apple_id'),'Novčanik se ne prikazuje bez potvrde administratora');
select pg_temp.expect_error('insert into public.payment_methods(code,name,provider,enabled,verified)values(''keks'',''KEKS Pay'',''stripe'',true,true)','Nepodržana integracija ne može se lažno uključiti kao Stripe');
insert into public.payment_methods(code,name,provider)values('custom_keks','KEKS Pay','unconnected')returning id as custom_id \gset
select pg_temp.expect_error(format('update public.payment_methods set enabled=true,verified=true where id=%L',:'custom_id'),'Nepovezana metoda ne može se prikazivati kao dostupna');
set role anon;select pg_temp.assert_true((select count(*)=2 from public.payment_methods),'Javnost ne vidi skriveni novčanik ni nepovezanu metodu');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
update public.payment_methods set enabled=true,verified=true where id=:'apple_id';
insert into storage.objects(bucket_id,name)values('payment-icons','custom_keks/88888888-8888-4888-8888-888888888888.png');
select pg_temp.assert_true((select count(*)=2 from storage.objects),'Admin može učitati ikonu vlastite metode');
set role anon;select pg_temp.assert_true((select count(*)=3 from public.payment_methods),'Javnost vidi potvrđeni Stripe novčanik');
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.expect_error('insert into public.payment_methods(code,name,provider)values(''google_pay'',''Google Pay'',''stripe'')','Korisnik ne dodaje metode plaćanja');
update public.payment_methods set enabled=false where code='apple_pay';
delete from public.payment_methods where code='visa';
select pg_temp.assert_true((select count(*)=3 from public.payment_methods),'Korisnik ne skriva ni uklanja metode plaćanja');
select pg_temp.expect_error('insert into storage.objects(bucket_id,name)values(''payment-icons'',''custom_keks/99999999-9999-4999-8999-999999999999.png'')','Korisnik ne učitava ikone vlastitih metoda');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
delete from public.payment_methods where code='mastercard';
set role anon;select pg_temp.assert_true((select count(*)=2 from public.payment_methods),'Uklonjena metoda nestaje iz javnog popisa');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
update public.payment_methods set enabled=false,verified=false where id=:'apple_id';
set role anon;select pg_temp.assert_true((select count(*)=1 from public.payment_methods),'Skriveni novčanik nestaje iz javnog popisa');
reset role;

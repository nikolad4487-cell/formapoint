reset role;
insert into auth.users(id,email,email_confirmed_at)values('b1700000-0000-4000-8000-000000000001','coupon-payment@example.invalid',now()),('b1700000-0000-4000-8000-000000000002','coupon-other@example.invalid',now());
update public.promo_codes set banner=false where banner;
insert into public.promo_codes(code,kind,value,max_uses,expires_at,banner)values('POPUST10','percent',10,100,now()+interval'30 days',true);
select pg_temp.assert_true((select payment_restriction='card_full'and first_order_only from public.promo_codes where code='POPUST10'),'POPUST10 uvijek dobiva pravilo prve kupnje i jednokratne kartice');
set role anon;
select pg_temp.assert_true(public.discount_banner()->>'payment_restriction'='card_full','Javni banner objavljuje ograničenje bez osobnih kodova');
reset role;
set role authenticated;select set_config('request.jwt.claim.sub','b1700000-0000-4000-8000-000000000001',false);
select public.cart_add((select id from public.services where slug='checkout-prvi'),1);
select pg_temp.assert_true((public.cart_pricing('POPUST10')->>'discount')::int=100 and not(public.cart_pricing('POPUST10')->>'split')::boolean and public.cart_pricing('POPUST10')->>'payment_restriction'='card_full','Košarica primjenjuje 10 posto i isključuje model 50/50');
select pg_temp.expect_error('select public.checkout_cart_order(gen_random_uuid(),''Test kupona'',''Upute za provjeru kupona'',now()+interval''2 day'',''bank'',''full'',''{"course":"Dokumenti"}'',''POPUST10'')','IBAN jednokratno s POPUST10 odbija se u bazi');
select pg_temp.expect_error('select public.checkout_cart_order(gen_random_uuid(),''Test kupona'',''Upute za provjeru kupona'',now()+interval''2 day'',''bank'',''split'',''{"course":"Dokumenti"}'',''POPUST10'')','IBAN 50/50 s POPUST10 odbija se u bazi');
select pg_temp.expect_error('select public.checkout_cart_order(gen_random_uuid(),''Test kupona'',''Upute za provjeru kupona'',now()+interval''2 day'',''card'',''split'',''{"course":"Dokumenti"}'',''POPUST10'')','Kartica 50/50 s POPUST10 odbija se u bazi');
select pg_temp.expect_error('select public.create_order((select id from public.services where slug=''checkout-prvi''),1,''Stari tok kupona'',''Upute za provjeru starog toka'',null,''split'',''POPUST10'')','Ni stari tok naručivanja ne može zaobići pravilo kartice');
select pg_temp.assert_true((select count(*)=0 from public.orders where user_id=auth.uid()),'Odbijeni pokušaji ne ostavljaju narudžbu ni troše prvu kupnju');
select public.checkout_cart_order(gen_random_uuid(),'Test kupona','Upute za jednokratnu karticu',now()+interval'2 day','card','full','{"course":"Dokumenti"}','POPUST10')as restricted_order \gset
select pg_temp.assert_true((select total_cents=901 and payment_method='card'and payment_model='full'and checkout_details->>'coupon_card_full'='true'from public.orders where id=:'restricted_order'),'Jednokratna kartica dobiva 10 posto i sačuvano pravilo');
select pg_temp.expect_error(format('select public.choose_order_payment(%L,''bank'')',:'restricted_order'),'Nakon korištenja kupona ne može se prijeći na IBAN');
reset role;
select pg_temp.expect_error(format('update public.orders set payment_model=''split''where id=%L',:'restricted_order'),'Ni izravna serverska promjena ne prebacuje kupon na 50/50');
-- Promjena naziva kupona ne mijenja već ugovoreni način plaćanja.
update public.promo_codes set code='PREIMENOVANI10',payment_restriction='any'where code='POPUST10';
set role authenticated;select set_config('request.jwt.claim.sub','b1700000-0000-4000-8000-000000000001',false);
select pg_temp.expect_error(format('select public.choose_order_payment(%L,''bank'')',:'restricted_order'),'Sačuvano pravilo vrijedi i nakon preimenovanja kupona');
select public.cart_add((select id from public.services where slug='checkout-prvi'),1);
select pg_temp.expect_error('select public.cart_pricing(''PREIMENOVANI10'')','Uvjet prve narudžbe i dalje se provjerava');
reset role;
insert into public.promo_codes(code,kind,value,max_uses,expires_at)values('OBICNI17','percent',10,100,now()+interval'30 days');
set role authenticated;select set_config('request.jwt.claim.sub','b1700000-0000-4000-8000-000000000002',false);
select public.cart_add((select id from public.services where slug='checkout-prvi'),1);
select pg_temp.assert_true((public.cart_pricing('OBICNI17')->>'split')::boolean,'Obični kupon ne gubi 50/50');
select public.checkout_cart_order(gen_random_uuid(),'Običan kupon','Upute za drugi obični kupon',now()+interval'2 day','bank','split','{"course":"Dokumenti"}','OBICNI17')as ordinary_order \gset
select pg_temp.assert_true((select payment_method='bank'and payment_model='split'and total_cents=901 from public.orders where id=:'ordinary_order'),'Ostali kuponi nastavljaju vrijediti za IBAN 50/50');
reset role;

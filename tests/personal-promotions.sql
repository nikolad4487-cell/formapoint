reset role;
insert into auth.users(id,email,email_confirmed_at)values('b7000000-0000-4000-8000-000000000001','promotion-one@example.invalid',now()),('b7000000-0000-4000-8000-000000000002','promotion-two@example.invalid',now()),('b7000000-0000-4000-8000-000000000003','promotion-optout@example.invalid',now());
update public.profiles set first_name='Ana',marketing_consent=true where id in('b7000000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000002');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.create_personal_promotion('c7000000-0000-4000-8000-000000000001','Božić test','christmas','percent',15,'Poklon za {ime}','Pozdrav {ime}, tvoj kod je {kod}.','https://example.invalid/christmas.jpg',array['b7000000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000003']::uuid[])as promotion \gset
select public.create_personal_promotion('c7000000-0000-4000-8000-000000000001','Božić test','christmas','percent',15,'Poklon za {ime}','Pozdrav {ime}, tvoj kod je {kod}.','https://example.invalid/christmas.jpg',array['b7000000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000003']::uuid[]);
select pg_temp.assert_true((select count(*)=3 and count(distinct code)=3 from public.promotion_deliveries where campaign_id=:'promotion'),'Svaki korisnik dobiva poseban kod, ponovljeni zahtjev ne stvara duplikate');
select pg_temp.assert_true((select expires_at-created_at=interval'30 days'and starts_at=created_at from public.promotion_campaigns where id=:'promotion'),'Zadani rok je 30 dana od kreiranja na poslužitelju');
select pg_temp.assert_true((select count(*)=3 and bool_and(p.max_uses=1 and p.customer_id=d.user_id)from public.promotion_deliveries d join public.promo_codes p on p.id=d.promo_id where d.campaign_id=:'promotion'),'Osobni kod vrijedi samo njegovu korisniku i jednom');
select pg_temp.assert_true((select count(*)=2 from public.promotion_deliveries where campaign_id=:'promotion'and status='pending'),'Samo korisnici s privolom čekaju e-mail');
select pg_temp.assert_true((select status='skipped'from public.promotion_deliveries where campaign_id=:'promotion'and user_id='b7000000-0000-4000-8000-000000000003'),'Odjavljeni korisnik ima svoj kod, ali ne dobiva promotivni e-mail');
select pg_temp.expect_error('select public.create_personal_promotion(''c7000000-0000-4000-8000-000000000001'',''Promijenjeno'',''christmas'',''percent'',15,''Poklon za {ime}'',''Pozdrav {ime}, tvoj kod je {kod}.'',''https://example.invalid/christmas.jpg'',array[''b7000000-0000-4000-8000-000000000001'']::uuid[])','Identifikator zahtjeva ne može se iskoristiti za drugačiju kampanju');
select pg_temp.expect_error('select public.claim_promotions(null,10)','Ni administrator preglednika ne može izravno preuzimati poslove slanja');
select pg_temp.expect_error('select secret from public.promotion_worker','Interni ključ workera nije dostupan korisničkom API-ju');
select public.create_personal_promotion('c7000000-0000-4000-8000-000000000002','Uskrs test','easter','fixed',500,'Poklon za {ime}','Pozdrav {ime}, tvoj kod je {kod}.','https://example.invalid/easter.jpg',array['b7000000-0000-4000-8000-000000000001']::uuid[],now()+interval'2 days')as future_promotion \gset
select code as future_code from public.promotion_deliveries where campaign_id=:'future_promotion' \gset
select code as owner_code from public.promotion_deliveries where campaign_id=:'promotion'and user_id='b7000000-0000-4000-8000-000000000001' \gset
select set_config('request.jwt.claim.sub','b7000000-0000-4000-8000-000000000001',false);
select public.cart_add((select id from public.services where slug='ista-izrada'and category='Slug Prezentacije'),1);
select pg_temp.expect_error(format('select public.cart_pricing(%L)',:'future_code'),'Budući osobni kod ne umanjuje košaricu prije početnog datuma');
select pg_temp.assert_true((public.cart_pricing(:'owner_code')->>'discount')::int=300,'Vlastiti osobni kod radi s postojećom košaricom');
select set_config('request.jwt.claim.sub','b7000000-0000-4000-8000-000000000002',false);
select public.cart_add((select id from public.services where slug='ista-izrada'and category='Slug Prezentacije'),1);
select pg_temp.expect_error(format('select public.cart_pricing(%L)',:'owner_code'),'Drugi korisnik ne može iskoristiti tuđi osobni kod');
select pg_temp.expect_error('select public.personal_promotion_summary()','Korisnik ne vidi kampanje ni kodove drugih korisnika');
reset role;
select public.claim_promotions(:'promotion',10);
select id as delivery,claim_token as token from public.promotion_deliveries where campaign_id=:'promotion'and user_id='b7000000-0000-4000-8000-000000000001' \gset
select pg_temp.assert_true((public.promotion_delivery_data(:'delivery',:'token')->>'allowed')::boolean,'Worker ponovno provjerava privolu i vlasništvo koda');
update public.profiles set marketing_consent=false where id='b7000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(not(public.promotion_delivery_data(:'delivery',:'token')->>'allowed')::boolean,'Odjava nakon kreiranja kampanje zaustavlja slanje');
select public.finish_promotion_delivery(:'delivery',gen_random_uuid(),'sent',null,'fake');
select pg_temp.assert_true((select status='processing'from public.promotion_deliveries where id=:'delivery'),'Stara ili tuđa rezervacija ne može potvrditi slanje');
select public.finish_promotion_delivery(:'delivery',:'token','skipped','Korisnik se odjavio',null);
select id as delivery2,claim_token as token2 from public.promotion_deliveries where campaign_id=:'promotion'and user_id='b7000000-0000-4000-8000-000000000002' \gset
select public.finish_promotion_delivery(:'delivery2',:'token2','sent',null,'fixture-provider-receipt');
select pg_temp.assert_true(public.claim_promotions(:'promotion',10)='[]'::jsonb,'Poslane i preskočene poruke ne šalju se ponovno');
select pg_temp.assert_true(public.promotion_worker_authorized((select secret from public.promotion_worker))and not public.promotion_worker_authorized('invalid'),'Interni worker prihvaća samo svoj poslužiteljski ključ');
update public.promotion_deliveries set status='failed',attempts=1,first_attempt_at=now(),next_attempt_at=now()+interval'1 minute'where campaign_id=:'future_promotion';
select pg_temp.assert_true(public.claim_promotions(:'future_promotion',10)='[]'::jsonb,'Automatski pokušaji poštuju odmak nakon greške');
update public.promotion_deliveries set first_attempt_at=now()-interval'24 hours',next_attempt_at=now()-interval'1 minute'where campaign_id=:'future_promotion';
select pg_temp.assert_true(public.claim_promotions(:'future_promotion',10)='[]'::jsonb,'Worker ne šalje neprovjerene stare pokušaje nakon isteka sigurnog prozora idempotencije');

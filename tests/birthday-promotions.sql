reset role;
insert into auth.users(id,email,email_confirmed_at)values
 ('b1600000-0000-4000-8000-000000000001','birthday-one@example.invalid',now()),
 ('b1600000-0000-4000-8000-000000000002','birthday-two@example.invalid',now()),
 ('b1600000-0000-4000-8000-000000000003','birthday-no-consent@example.invalid',now()),
 ('b1600000-0000-4000-8000-000000000004','birthday-tomorrow@example.invalid',now());
update public.profiles set birthday_day=extract(day from now()at time zone'Europe/Zagreb'),birthday_month=extract(month from now()at time zone'Europe/Zagreb')where id::text like'b1600000%';
update public.profiles set birthday_day=extract(day from(now()at time zone'Europe/Zagreb')+interval'1 day'),birthday_month=extract(month from(now()at time zone'Europe/Zagreb')+interval'1 day')where id='b1600000-0000-4000-8000-000000000004';
update public.profiles set marketing_consent=true where id in('b1600000-0000-4000-8000-000000000001','b1600000-0000-4000-8000-000000000002','b1600000-0000-4000-8000-000000000004');
select pg_temp.assert_true(public.birthday_in_year(29,2,2027)='2027-02-28'::date and public.birthday_in_year(29,2,2028)='2028-02-29'::date,'Rođendan 29. veljače ispravno prati prijestupne godine');
select pg_temp.assert_true(public.enqueue_birthday_promotions()=0,'Bez uključene postavke nema rođendanskih kupona');
set role authenticated;select set_config('request.jwt.claim.sub','b1600000-0000-4000-8000-000000000001',false);
select pg_temp.expect_error('select public.save_birthday_promotion(''Poklon'',''percent'',15,''Poklon za {ime}'',''Tvoj rođendanski poklon je {kod}.'',''https://example.invalid/birthday.jpg'')','Kupac ne postavlja rođendansku kampanju');
select pg_temp.expect_error('select public.enqueue_birthday_promotions()','Korisnički API ne kreira rođendanske kupone');
select pg_temp.assert_true((select count(*)=0 from public.birthday_promotion_settings),'Postavke rođendanske promocije nisu javne kupcu');
select pg_temp.expect_error('update public.profiles set birthday_day=31,birthday_month=2 where id=auth.uid()','Neispravan rođendan se odbija');
select pg_temp.expect_error('update public.profiles set birthday_day=null where id=auth.uid()','Rođendan zahtijeva i dan i mjesec');
update public.profiles set birthday_day=29,birthday_month=2 where id=auth.uid();
select pg_temp.assert_true((select birthday_day=29 and birthday_month=2 from public.profiles where id=auth.uid()),'Korisnik smije spremiti vlastiti rođendan bez godine');
update public.profiles set birthday_day=extract(day from now()at time zone'Europe/Zagreb'),birthday_month=extract(month from now()at time zone'Europe/Zagreb')where id=auth.uid();
update public.profiles set birthday_day=null,birthday_month=null where id='b1600000-0000-4000-8000-000000000002';
reset role;
select pg_temp.assert_true((select birthday_day is not null from public.profiles where id='b1600000-0000-4000-8000-000000000002'),'RLS ne dopušta promjenu tuđeg rođendana');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.save_birthday_promotion('Rođendanski poklon','percent',15,'Poklon za {ime}','Tvoj rođendanski poklon je {kod}.','https://example.invalid/birthday.jpg',30,true);
select pg_temp.expect_error('select public.save_birthday_promotion(''Poklon'',''percent'',150,''Poklon za {ime}'',''Tvoj rođendanski poklon je {kod}.'',''https://example.invalid/birthday.jpg'')','Neispravan postotak se odbija');
reset role;set role service_role;
select pg_temp.assert_true(public.enqueue_birthday_promotions()=2,'Worker stvara kodove samo slavljenicima s privolom');
select pg_temp.assert_true(public.enqueue_birthday_promotions()=0,'Ponovljeni worker ne stvara duplikate');
reset role;
select pg_temp.assert_true((select count(*)=2 and count(distinct promo_id)=2 from public.birthday_promotion_issues),'Svaki slavljenik ima poseban kod');
select pg_temp.assert_true((select bool_and(p.max_uses=1 and p.customer_id=i.user_id and(p.starts_at at time zone'Europe/Zagreb')::date=i.birthday_date and(p.expires_at at time zone'Europe/Zagreb')::date=i.birthday_date+30)from public.birthday_promotion_issues i join public.promo_codes p on p.id=i.promo_id),'Kod vrijedi jednom i 30 kalendarskih dana od vlastitog rođendana');
select campaign_id as birthday_campaign from public.birthday_promotion_issues where user_id='b1600000-0000-4000-8000-000000000001' \gset
select pg_temp.assert_true(jsonb_array_length(public.claim_promotions(:'birthday_campaign',10))=2,'Rođendanski kodovi ulaze u postojeći red slanja');
select id as birthday_delivery,claim_token as birthday_claim from public.promotion_deliveries where campaign_id=:'birthday_campaign'and user_id='b1600000-0000-4000-8000-000000000001' \gset
select pg_temp.assert_true((public.promotion_delivery_data(:'birthday_delivery',:'birthday_claim')->>'allowed')::boolean,'Rođendanska poruka prije slanja provjerava privolu');
update public.profiles set birthday_day=null,birthday_month=null where id='b1600000-0000-4000-8000-000000000001';
select pg_temp.assert_true(not(public.promotion_delivery_data(:'birthday_delivery',:'birthday_claim')->>'allowed')::boolean,'Uklanjanje rođendana prije slanja zaustavlja rezerviranu poruku');
update public.profiles set birthday_day=extract(day from now()at time zone'Europe/Zagreb'),birthday_month=extract(month from now()at time zone'Europe/Zagreb')where id='b1600000-0000-4000-8000-000000000001';
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.save_birthday_promotion('Rođendanski poklon','percent',15,'Poklon za {ime}','Tvoj rođendanski poklon je {kod}.','https://example.invalid/birthday.jpg',30,false);
reset role;
select pg_temp.assert_true(not(public.promotion_delivery_data(:'birthday_delivery',:'birthday_claim')->>'allowed')::boolean,'Isključenje zaustavlja i već rezerviranu rođendansku poruku');
select pg_temp.assert_true(public.enqueue_birthday_promotions()=0,'Isključena promocija ne izrađuje nove kodove');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.save_birthday_promotion('Rođendanski poklon','percent',20,'Poklon za {ime}','Tvoj rođendanski poklon je {kod}.','https://example.invalid/birthday.jpg',30,true);
reset role;
select pg_temp.assert_true(public.enqueue_birthday_promotions()=0,'Uređivanje i ponovno uključivanje ne šalje drugi poklon iste godine');
update public.profiles set birthday_day=extract(day from now()at time zone'Europe/Zagreb'),birthday_month=extract(month from now()at time zone'Europe/Zagreb')where id='b1600000-0000-4000-8000-000000000004';
select pg_temp.assert_true(public.enqueue_birthday_promotions()=1,'Korisnik s naknadno unesenim današnjim rođendanom dobiva svoj kod');
-- Brisanje kupona ne smije omogućiti novu godišnju poruku.
delete from public.promo_codes where id=(select promo_id from public.birthday_promotion_issues where user_id='b1600000-0000-4000-8000-000000000004');
select pg_temp.assert_true(public.enqueue_birthday_promotions()=0,'Brisanje kupona zadržava godišnju zaštitu od duplikata');
-- Evidencija prošle godine ne sprečava novi godišnji poklon.
update public.birthday_promotion_issues set birthday_year=birthday_year-1 where user_id='b1600000-0000-4000-8000-000000000004';
select pg_temp.assert_true(public.enqueue_birthday_promotions()=1,'Prošlogodišnji poklon ne blokira ovogodišnji');

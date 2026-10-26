reset role;update public.profiles set marketing_consent=true where id='b7000000-0000-4000-8000-000000000001';
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.create_personal_promotion('c7000000-0000-4000-8000-000000000015','Zakazani Božić','christmas','percent',10,'Poklon za {ime}','Pozdrav {ime}, tvoj kod je {kod}.','https://example.invalid/christmas.jpg',array['b7000000-0000-4000-8000-000000000001']::uuid[],now()+interval'40 days')as scheduled \gset
select pg_temp.assert_true((select expires_at-starts_at=interval'30 days'from public.promotion_campaigns where id=:'scheduled'),'Promocija više od 30 dana u budućnosti ima valjan automatski završetak');
reset role;
select pg_temp.assert_true(public.claim_promotions(:'scheduled',10)='[]'::jsonb,'Ni ručna obrada ne preuzima buduće e-mailove');
select pg_temp.assert_true(public.claim_promotions(:'scheduled',10)='[]'::jsonb,'Ponovna obrada prije datuma ništa ne šalje');
select pg_temp.assert_true((select attempts=0 and first_attempt_at is null and status='pending'from public.promotion_deliveries where campaign_id=:'scheduled'),'Čekanje do datuma ne troši pokušaje niti razdoblje ponovnog slanja');
-- Simulacija dolaska početnog trenutka bez stvarnog slanja e-maila.
update public.promotion_campaigns set starts_at=now()-interval'1 minute'where id=:'scheduled';
update public.promo_codes set starts_at=now()-interval'1 minute'where id in(select promo_id from public.promotion_deliveries where campaign_id=:'scheduled');
select public.claim_promotions(:'scheduled',10)as scheduled_claim \gset
select pg_temp.assert_true(jsonb_array_length(:'scheduled_claim')=1,'Posao postaje dostupan kada počne valjanost');
select id as scheduled_delivery,claim_token as scheduled_token from public.promotion_deliveries where campaign_id=:'scheduled' \gset
select pg_temp.assert_true((public.promotion_delivery_data(:'scheduled_delivery',:'scheduled_token')->>'allowed')::boolean,'E-mail je dopušten nakon početka valjanosti');
update public.promotion_campaigns set starts_at=now()+interval'1 day'where id=:'scheduled';
select pg_temp.assert_true(not(public.promotion_delivery_data(:'scheduled_delivery',:'scheduled_token')->>'allowed')::boolean,'Već rezerviran posao ponovno provjerava datum prije slanja');
select pg_temp.assert_true((public.promotion_delivery_data(:'scheduled_delivery',:'scheduled_token')->>'send_at')::timestamptz>now(),'Worker dobiva stvarni najraniji trenutak slanja');

-- Ovi testovi nastavljaju isti PostgreSQL testni session; ne šalju e-poštu.
reset role;
update auth.users set email='customer@example.invalid'where id='11111111-1111-4111-8111-111111111111';
update auth.users set email='other@example.invalid',email_confirmed_at=now()where id='22222222-2222-4222-8222-222222222222';
update auth.users set email='admin@example.invalid',email_confirmed_at=now()where id='33333333-3333-4333-8333-333333333333';
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.expect_error('select public.admin_users()','Adresar korisnika zahtijeva admin ulogu');
select pg_temp.expect_error('select public.admin_summary()','Sažetak zahtijeva admin ulogu');
select pg_temp.expect_error('select public.claim_newsletter()','Preglednik ne preuzima e-mail poslove i tokene');
select pg_temp.expect_error('select * from public.newsletter_optouts','Privatni tokeni nisu dostupni korisnicima');
select pg_temp.assert_true((select count(*)=0 from public.business_settings),'Poslovni i bankovni podaci ostaju privatni');
update public.site_settings set platform_name='Neovlaštena promjena'where id=true;
select pg_temp.assert_true((select platform_name='FormaPoint'from public.site_settings),'RLS odbija neovlaštenu promjenu postavki');
update public.profiles set marketing_consent=true where id=auth.uid();
reset role;select pg_temp.assert_true((select status='pending'from public.newsletter_subscribers where user_id='11111111-1111-4111-8111-111111111111'),'Nepotvrđena adresa ne prima newsletter');
update auth.users set email_confirmed_at=now()where id='11111111-1111-4111-8111-111111111111';
select pg_temp.assert_true((select status='subscribed'from public.newsletter_subscribers where user_id='11111111-1111-4111-8111-111111111111'),'Potvrda adrese i privola aktiviraju pretplatu');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select pg_temp.assert_true((select email='customer@example.invalid'from public.admin_users('customer')),'Admin adresar vraća stvarni Auth e-mail');
select pg_temp.expect_error('update public.site_settings set instagram_url=''javascript:alert(1)''','Opasna javna poveznica odbijena na serveru');
select pg_temp.expect_error('update public.business_settings set iban=''HR1210010051863000161''','Server provjerava IBAN checksum');
update public.business_settings set iban='HR12 1001 0051 8630 0016 0';
select pg_temp.assert_true((select iban='HR1210010051863000160'from public.business_settings),'Valjan IBAN je normaliziran');
insert into public.content_pages(slug,title,content)values('primjer','Primjer stranice','Ovo je dovoljno dug sadržaj.')returning id as page_id \gset
insert into public.content_pages(slug,title,content)values('uvjeti-koristenja','Uvjeti korištenja','Ovo je pravni tekst za testiranje.')returning id as legal_id \gset
select pg_temp.expect_error(format('update public.content_pages set published=true where id=%L',:'legal_id'),'Pravna stranica zahtijeva izričito odobrenje');
update public.content_pages set published=true,approved_by=auth.uid()where id=:'legal_id';
select pg_temp.assert_true((select approved_at is not null from public.content_pages where id=:'legal_id'),'Pravna objava bilježi odobrenje');
set role anon;select pg_temp.assert_true((select count(*)=1 from public.content_pages),'Posjetitelj vidi samo objavljenu stranicu');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
update public.content_pages set published=false,content='Izmijenjeni pravni tekst ponovno čeka objavu.'where id=:'legal_id';
select pg_temp.assert_true((select approved_at is null and approved_by is null from public.content_pages where id=:'legal_id'),'Izmjena pravnog teksta poništava ranije odobrenje');
select pg_temp.expect_error('insert into public.portfolio_items(title,description,pdf_url,published)values(''Primjer rada'',''Dovoljno dug opis rada'',''https://example.invalid/rad.pdf'',true)','Portfolio zahtijeva dopuštenje za objavu');
insert into public.portfolio_items(title,description,pdf_url,publication_rights,published)values('Primjer rada','Dovoljno dug opis rada','https://example.invalid/rad.pdf',true,true)returning id as portfolio_id \gset
select pg_temp.assert_true((select scan_status='linked'from public.portfolio_items where id=:'portfolio_id'),'Vanjska poveznica ne prikazuje se kao antivirusno provjerena');
select pg_temp.expect_error(format('update public.portfolio_items set scan_status=''clean''where id=%L',:'portfolio_id'),'Preglednik ne odobrava skeniranje izravnom izmjenom');
select pg_temp.expect_error('insert into public.portfolio_items(title,description,file_path,scan_status)values(''Primjer rada'',''Dovoljno dug opis rada'',''tajna.pdf'',''clean'')','Preglednik ne zaobilazi privatni prijenos datoteke');
set role anon;select pg_temp.assert_true((select count(*)=1 from public.portfolio_items),'Odobreni vanjski portfolio vidljiv je javnosti');
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
insert into public.newsletter_campaigns(subject,html)values('Testna kampanja','<p>Ovo je testna kampanja.</p>')returning id as campaign_id \gset
select pg_temp.assert_true(public.queue_newsletter(:'campaign_id')=1,'Kampanja cilja isključivo potvrđene korisnike s privolom');
select pg_temp.expect_error(format('select public.queue_newsletter(%L)',:'campaign_id'),'Ista kampanja ne stvara dvostruke dostave');
update public.newsletter_campaigns set html='<p>Nedopuštena izmjena nakon slanja</p>'where id=:'campaign_id';
select pg_temp.assert_true((select html='<p>Ovo je testna kampanja.</p>'from public.newsletter_campaigns where id=:'campaign_id'),'Sadržaj kampanje je zamrznut nakon početka slanja');
select pg_temp.expect_error('select * from public.newsletter_optouts','Ni admin ne čita tajne tokene preko javnog API-ja');
reset role;select token as optout from public.newsletter_optouts t join public.newsletter_subscribers s on s.id=t.subscriber_id where s.user_id='11111111-1111-4111-8111-111111111111' \gset
set role anon;select pg_temp.assert_true(public.unsubscribe_newsletter(:'optout'),'Odjava radi putem slučajnog tokena bez prijave');
reset role;select pg_temp.assert_true((select not marketing_consent from public.profiles where id='11111111-1111-4111-8111-111111111111'),'Odjava ažurira i izvornu privolu korisnika');
set role service_role;select pg_temp.assert_true((public.claim_newsletter()->0->>'allowed')::boolean=false,'Worker ponovno provjerava privolu prije slanja');
select pg_temp.assert_true(jsonb_array_length(public.claim_newsletter())=0,'Istodobni worker ne dobiva već zaključanu dostavu');
reset role;update public.newsletter_deliveries set status='skipped'where campaign_id=:'campaign_id';
set role authenticated;select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
insert into public.newsletter_campaigns(subject,html)values('Prazna kampanja','<p>Nema potvrđenih pretplatnika.</p>')returning id as empty_campaign \gset
select pg_temp.expect_error(format('select public.queue_newsletter(%L)',:'empty_campaign'),'Bez privole se ništa ne stavlja u red za slanje');
insert into public.promo_codes(code,kind,value,max_uses,expires_at,customer_id)values('SAMOZAJEDNOG','percent',20,5,now()+interval'1 day','11111111-1111-4111-8111-111111111111')returning id as promo_id \gset
select public.set_discount_banner(:'promo_id',true);
set role anon;select pg_temp.assert_true(public.discount_banner()is null,'Kupon za pojedinca nije javno otkriven bannerom');
reset role;update public.services set active=true where id=:'sid';
set role authenticated;select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.expect_error(format('select public.create_order(%L,1,''Pokušaj tuđeg koda'',''Dovoljno detaljan opis narudžbe'',null,''full'',''SAMOZAJEDNOG'')',:'sid'),'Server odbija kupon namijenjen drugom korisniku');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
update public.site_settings set policies_approved=true,cancellation_days=14,final_payment_days=7;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_order(:'sid',1,'Provjera ugovorenih rokova','Opis narudžbe za provjeru zaključavanja uvjeta',null,'full',null)as policy_order \gset
select pg_temp.assert_true((select cancellation_deadline_at>now()+interval'13 days'and final_payment_window_days=7 from public.orders where id=:'policy_order'),'Nova narudžba pamti odobrene rokove');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
update public.site_settings set final_payment_days=30;
select pg_temp.assert_true((select final_payment_window_days=7 from public.orders where id=:'policy_order'),'Promjena postavki ne mijenja prethodne ugovorene rokove');
reset role;

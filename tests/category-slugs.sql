reset role;
insert into public.service_categories(name,slug)values('Slug Prezentacije','slug-prezentacije'),('Slug Završni rad','slug-zavrsni-rad');
insert into public.services(name,slug,category,description,price_cents)values('Izrada prezentacije','ista-izrada','Slug Prezentacije','Opis prezentacije za provjeru slugova',2000),('Izrada završnog','ista-izrada','Slug Završni rad','Opis završnog za provjeru slugova',6000);
select pg_temp.assert_true((select count(*)=2 from public.services where slug='ista-izrada'),'Različite kategorije mogu imati isti slug artikla');
select pg_temp.expect_error('insert into public.services(name,slug,category,description)values(''Duplikat'',''ista-izrada'',''Slug Prezentacije'',''Opis duplikata'')','Isti slug unutar iste kategorije odbija baza');
select pg_temp.expect_error('update public.services set category=''Slug Prezentacije''where slug=''ista-izrada''and category=''Slug Završni rad''','Premještanje ne može stvoriti dupli slug u kategoriji');
select pg_temp.expect_error('insert into public.service_categories(name,slug)values(''Rezervirano'',''admin'')','Kategorija ne preuzima rezervirane putanje aplikacije');

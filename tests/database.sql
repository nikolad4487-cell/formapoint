\set ON_ERROR_STOP on
create function pg_temp.assert_true(value boolean,label text)returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.expect_error(command text,label text)returns void language plpgsql as $$declare failed boolean:=false;begin begin execute command;exception when others then failed:=true;end;perform pg_temp.assert_true(failed,label);end$$;
insert into auth.users(id)values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
insert into public.user_roles values('33333333-3333-4333-8333-333333333333','ADMIN');
update public.services set price_cents=2501,split_enabled=true,split_min_cents=200 where slug='excel';
select id as sid from public.services where slug='excel' \gset
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.assert_true(not public.is_admin(),'Korisnik nema admin prava');
select pg_temp.expect_error('insert into public.user_roles values(auth.uid(),''ADMIN'')','Nema eskalacije uloge');
select pg_temp.expect_error('update public.orders set paid_cents=99999','Nema izmjene uplata iz preglednika');
select pg_temp.expect_error('insert into public.payments(order_id,installment,amount_cents,status)values(gen_random_uuid(),1,100,''succeeded'')','Nema lažnih uplata');
select public.create_order(:'sid',1,'Test narudžba','Dovoljno detaljan opis zadatka',null,'split',null)as oid \gset
select pg_temp.assert_true((select total_cents=2501 and paid_cents=0 and status='deposit_pending'from public.orders where id=:'oid'),'Serverski izračun i početni status');
select pg_temp.assert_true((select amount_cents=1251 from public.payment_installments where order_id=:'oid'and installment=1),'Prva rata s dodatnim centom');
select pg_temp.assert_true((select amount_cents=1250 from public.payment_installments where order_id=:'oid'and installment=2),'Druga rata bez gubitka centa');
select pg_temp.expect_error(format('select public.transition_order(%L,''ready'')',:'oid'),'Korisnik ne mijenja status');
select public.send_message(:'oid','Poruka vlasnika narudžbe',false);
select pg_temp.expect_error(format('select public.send_message(%L,''Tajna bilješka'',true)',:'oid'),'Korisnik ne piše internu bilješku');
select public.cart_set(:'sid',3);select pg_temp.assert_true((select count(*)=1 from public.cart_items),'Košarica je spremljena');select public.cart_set(:'sid',0);select pg_temp.assert_true((select count(*)=0 from public.cart_items),'Stavka se uklanja');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.assert_true((select count(*)=0 from public.orders),'RLS skriva tuđe narudžbe');select pg_temp.assert_true((select count(*)=0 from public.order_messages),'RLS skriva tuđe poruke');
select pg_temp.expect_error(format('select public.send_message(%L,''Neovlašten pristup'',false)',:'oid'),'Tuđa poruka je odbijena');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select pg_temp.assert_true(public.is_admin(),'Admin prava su potvrđena');
select public.send_message(:'oid','Interna napomena',true);
update public.services set price_cents=9000 where id=:'sid';select pg_temp.assert_true((select total_cents=2501 from public.orders where id=:'oid'),'Promjena cjenika ne mijenja zaključanu narudžbu');
select pg_temp.expect_error(format('select public.transition_order(%L,''in_progress'')',:'oid'),'Izrada ne počinje bez uplate');
reset role;update public.site_settings set stripe_enabled=true,maintenance=false;
select public.reserve_payment(:'oid','11111111-1111-4111-8111-111111111111')as payment \gset
select id as pid from public.payments where order_id=:'oid'and installment=1 \gset
select pg_temp.assert_true((public.reserve_payment(:'oid','11111111-1111-4111-8111-111111111111')).id=:'pid','Idempotentna rezervacija naplate');
select pg_temp.expect_error(format('select public.apply_stripe_event(''evt_bad'',''checkout.session.completed'',%L,''cs_1'',''pi_1'',1,''eur'',''succeeded'',0,null)',:'pid'),'Pogrešan iznos webhooka je odbijen');
select public.apply_stripe_event('evt_1','checkout.session.completed',:'pid','cs_1','pi_1',1251,'eur','succeeded',0,50);
select public.apply_stripe_event('evt_1','checkout.session.completed',:'pid','cs_1','pi_1',1251,'eur','succeeded',0,50);
select pg_temp.assert_true((select paid_cents=1251 and status='ready'from public.orders where id=:'oid'),'Ponovljeni webhook ne udvostručuje uplatu');
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.assert_true((select count(*)=1 from public.order_messages where order_id=:'oid'),'Interna bilješka je skrivena od vlasnika');
select pg_temp.expect_error(format('select public.apply_stripe_event(''evil'',''x'',%L,''cs_1'',''pi_1'',1251,''eur'',''succeeded'',0,null)',:'pid'),'Korisnik nema EXECUTE nad webhook obradom');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.transition_order(:'oid','in_progress');select public.transition_order(:'oid','work_done');
select pg_temp.expect_error(format('select public.transition_order(%L,''delivered'')',:'oid'),'Isporuka je zaključana bez druge uplate');
select public.transition_order(:'oid','final_pending');reset role;
select (public.reserve_payment(:'oid','11111111-1111-4111-8111-111111111111')).id as pid2 \gset
select public.apply_stripe_event('evt_2','checkout.session.completed',:'pid2','cs_2','pi_2',1250,'eur','succeeded',0,50);
select pg_temp.assert_true((select paid_cents=total_cents and status='delivered'from public.orders where id=:'oid'),'Druga uplata dopušta isporuku');
select public.apply_stripe_event('evt_refund','charge.refunded',:'pid2','cs_2','pi_2',1250,'eur','partially_refunded',500,null);
select pg_temp.assert_true((select paid_cents=2001 from public.orders where id=:'oid'),'Povrat umanjuje potvrđeno plaćeni iznos');
select public.apply_stripe_event('evt_late','checkout.session.completed',:'pid2','cs_2','pi_2',1250,'eur','succeeded',0,null);
select pg_temp.assert_true((select refunded_cents=500 from public.payments where id=:'pid2'),'Zakašnjeli uspjeh ne briše povrat');
-- Ponude, verzije i zaključavanje cijene.
select id as quote_service from public.services where slug='word-dokumenti' \gset
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_order(:'quote_service',1,'Individualni zadatak','Detaljan opis individualnog zadatka')as qo \gset
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.create_quote(:'qo','Opseg ponude i dogovoreni uvjeti',5001,now()+interval '1 day',now()+interval '7 days',true)as q1 \gset
select public.create_quote(:'qo','Ažurirani opseg i uvjeti ponude',6001,now()+interval '1 day',now()+interval '7 days',true)as q2 \gset
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.expect_error(format('select public.accept_quote(%L,''full'')',:'q2'),'Tuđa ponuda nije dostupna');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.expect_error(format('select public.accept_quote(%L,''full'')',:'q1'),'Stara verzija ponude je odbijena');
select public.accept_quote(:'q2','split');select pg_temp.assert_true((select total_cents=6001 from public.orders where id=:'qo'),'Prihvaćena je aktualna cijena ponude');select pg_temp.expect_error(format('select public.accept_quote(%L,''full'')',:'q2'),'Ponuda se ne prihvaća dvaput');
reset role;insert into public.promo_codes(code,kind,value,max_uses,expires_at)values('POPUST','percent',10,1,now()+interval '1 day');
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_order(:'sid',1,'Narudžba s kuponom','Opis zadatka i korištenje kupona',null,'full','POPUST')as co \gset
select pg_temp.assert_true((select total_cents=8100 from public.orders where id=:'co'),'Kupon se izračunava na serveru');
select pg_temp.expect_error(format('select public.create_order(%L,1,''Ponovljen kupon'',''Pokušaj višestrukog korištenja kupona'',null,''full'',''POPUST'')',:'sid'),'Kupon se ne koristi dvaput');
select public.open_ticket('Izvoz osobnih podataka','Izvoz podataka','Molim izvoz mojih osobnih podataka.')as ticket \gset
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.assert_true((select count(*)=0 from public.support_tickets),'RLS skriva tuđe zahtjeve podrške');
select pg_temp.expect_error(format('select public.reply_ticket(%L,''Neovlašteni odgovor'',false)',:'ticket'),'Tuđi zahtjev ne dopušta odgovor');
reset role;select pg_temp.assert_true((select count(*)>0 from public.audit_logs),'Kritične radnje imaju audit zapis');
select pg_temp.assert_true(not(select public from storage.buckets where id='order-files'),'Storage bucket je privatan');
select pg_temp.assert_true((select bool_and(rowsecurity)from pg_tables where schemaname='public'),'Sve javne tablice imaju RLS');
set role authenticated;select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.create_order(:'sid',1,'Puna uplata test','Narudžba za provjeru pune uplate',null,'full',null)as fullorder \gset
reset role;select(public.reserve_payment(:'fullorder','22222222-2222-4222-8222-222222222222')).id as fullpayment \gset
select public.apply_stripe_event('evt_fail','checkout.session.async_payment_failed',:'fullpayment','cs_fail',null,9000,'eur','failed',0,null);
select pg_temp.assert_true((select paid_cents=0 and status='deposit_pending'from public.orders where id=:'fullorder'),'Neuspješna uplata ne otključava izradu');
select(public.reserve_payment(:'fullorder','22222222-2222-4222-8222-222222222222')).id as retry \gset
select pg_temp.assert_true(:'retry'<>:'fullpayment','Nakon neuspjeha nastaje novi pokušaj');
select public.apply_stripe_event('evt_full','checkout.session.completed',:'retry','cs_full','pi_full',9000,'eur','succeeded',0,100);
select pg_temp.assert_true((select paid_cents=9000 and status='ready'from public.orders where id=:'fullorder'),'Puna uplata priprema izradu');
select public.apply_stripe_event('evt_failed_late','checkout.session.async_payment_failed',:'retry','cs_full','pi_full',9000,'eur','failed',0,null);
select pg_temp.assert_true((select paid_cents=9000 from public.orders where id=:'fullorder'),'Zakašnjeli neuspjeh ne poništava potvrđenu uplatu');
select pg_temp.assert_true(not has_function_privilege('anon','public.mark_file_scanned(uuid,text,text)','EXECUTE'),'Anonimni korisnik ne odobrava datoteke');
-- Deaktiviranu stavku korisnik mora moći ukloniti iako joj katalog više nije vidljiv.
set role authenticated;select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.cart_set(:'sid',1);reset role;update public.services set active=false where id=:'sid';
set role authenticated;select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.cart_set(:'sid',0);select pg_temp.assert_true((select count(*)=0 from public.cart_items),'Deaktivirana usluga može se ukloniti iz košarice');
reset role;

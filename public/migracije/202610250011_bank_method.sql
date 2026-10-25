-- FormaPoint: povezivanje IBAN kartice s bankovnom uplatom. Čuva postojeće ikone i uplate.
-- Pokrenite cijelu datoteku jednom nakon nadogradnje 010.
BEGIN;
DO $fp_guard$BEGIN
 IF to_regprocedure('public.checkout_cart_order(uuid,text,text,timestamp with time zone,text,text,jsonb,text)')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 010.';END IF;
 IF to_regprocedure('public.configure_bank_method(boolean)')IS NOT NULL THEN RAISE EXCEPTION 'Nadogradnja 011 već je primijenjena.';END IF;
END $fp_guard$;
-- IBAN je stvarna ručna bankovna uplata, a ne nepovezani pružatelj.
alter table public.payment_methods drop constraint payment_methods_provider_check,drop constraint payment_methods_check;
alter table public.payment_methods add constraint payment_methods_provider_check check(provider in('stripe','bank','unconnected'));
alter table public.payment_methods add constraint payment_methods_adapter_check check(
 (provider='stripe'and code in('visa','mastercard','apple_pay','google_pay'))or(provider='bank'and code='iban')or(provider='unconnected'and not enabled));
-- Zadržava ID i već učitanu ikonu ranije dodanog IBAN-a.
do $$declare legacy uuid;begin
 select id into legacy from public.payment_methods where code='iban'limit 1;
 if legacy is null then select id into legacy from public.payment_methods where provider='unconnected'and lower(trim(name))in('iban','iban uplata','uplata na iban','bankovna uplata')order by(icon_url is null),created_at,id limit 1;end if;
 if legacy is not null then update public.payment_methods set code='iban',name='IBAN',provider='bank',enabled=(select bank_enabled from public.site_settings where id=true),verified=true where id=legacy;
 elsif exists(select 1 from public.site_settings where bank_enabled)then insert into public.payment_methods(code,name,provider,enabled,verified)values('iban','IBAN','bank',true,true);end if;
end$$;

create function public.bank_method_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_op='UPDATE'and old.provider='bank'and(new.provider<>'bank'or new.code<>'iban')then raise exception 'IBAN metodu možete sakriti ili ukloniti; vrsta se ne mijenja';end if;
 if new.provider='bank'and new.enabled is distinct from(select bank_enabled from public.site_settings where id=true)then raise exception 'IBAN uključite kroz postavke bankovne uplate';end if;return new;
end$$;
create trigger bank_method_guard before insert or update on public.payment_methods for each row execute function public.bank_method_guard();
create function public.sync_bank_method()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.bank_enabled then
  insert into public.payment_methods(code,name,provider,enabled,verified)values('iban','IBAN','bank',true,true)on conflict(code)do update set enabled=true,verified=true;
 else update public.payment_methods set enabled=false where provider='bank'and code='iban';end if;return new;
end$$;
create trigger sync_bank_method after update of bank_enabled on public.site_settings for each row execute function public.sync_bank_method();
create function public.removed_bank_method()returns trigger language plpgsql security definer set search_path=public as $$begin
 if old.provider='bank'then update public.site_settings set bank_enabled=false where id=true;end if;return old;
end$$;
create trigger removed_bank_method after delete on public.payment_methods for each row execute function public.removed_bank_method();
create function public.configure_bank_method(p_enabled boolean)returns void language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();
 if p_enabled is null then raise exception 'Odaberite uključivanje ili isključivanje IBAN-a';end if;
 if p_enabled and not exists(select 1 from public.business_settings where id=true and coalesce(trim(iban),'')<>''and coalesce(trim(payment_recipient),'')<>'')then raise exception 'Najprije spremite primatelja i valjani IBAN u odjeljku Podaci za uplatu';end if;
 insert into public.payment_methods(code,name,provider,enabled,verified)select 'iban','IBAN','bank',bank_enabled,true from public.site_settings where id=true on conflict(code)do nothing;
 update public.site_settings set bank_enabled=p_enabled where id=true;
end$$;
revoke all on function public.bank_method_guard(),public.sync_bank_method(),public.removed_bank_method(),public.configure_bank_method(boolean)from public,anon,authenticated;
grant execute on function public.configure_bank_method(boolean)to authenticated;
drop policy payment_methods_public on public.payment_methods;
create policy payment_methods_public on public.payment_methods for select to anon,authenticated using(enabled and(
 (provider='stripe'and(code in('visa','mastercard')or verified))or(provider='bank'and code='iban'and exists(select 1 from public.site_settings where bank_enabled and not maintenance))));
NOTIFY pgrst,'reload schema';

create or replace function public.checkout_options()returns jsonb language plpgsql stable security definer set search_path=public as $$
declare s public.site_settings;b public.business_settings;
begin
 perform public.assert_user();select * into s from public.site_settings where id=true;select * into b from public.business_settings where id=true;
 return jsonb_build_object('card',s.stripe_enabled and not s.maintenance,
 'google_pay',s.stripe_enabled and not s.maintenance and exists(select 1 from public.payment_methods where code='google_pay'and provider='stripe'and enabled and verified),
 'apple_pay',s.stripe_enabled and not s.maintenance and exists(select 1 from public.payment_methods where code='apple_pay'and provider='stripe'and enabled and verified),
 'bank',exists(select 1 from public.payment_methods where provider='bank'and code='iban'and enabled)and s.bank_enabled and not s.maintenance and coalesce(trim(b.iban),'')<>''and coalesce(trim(b.payment_recipient),'')<>'');
end$$;

NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610250011','bank_method',ARRAY[$fp_source$-- IBAN je stvarna ručna bankovna uplata, a ne nepovezani pružatelj.
alter table public.payment_methods drop constraint payment_methods_provider_check,drop constraint payment_methods_check;
alter table public.payment_methods add constraint payment_methods_provider_check check(provider in('stripe','bank','unconnected'));
alter table public.payment_methods add constraint payment_methods_adapter_check check(
 (provider='stripe'and code in('visa','mastercard','apple_pay','google_pay'))or(provider='bank'and code='iban')or(provider='unconnected'and not enabled));
-- Zadržava ID i već učitanu ikonu ranije dodanog IBAN-a.
do $$declare legacy uuid;begin
 select id into legacy from public.payment_methods where code='iban'limit 1;
 if legacy is null then select id into legacy from public.payment_methods where provider='unconnected'and lower(trim(name))in('iban','iban uplata','uplata na iban','bankovna uplata')order by(icon_url is null),created_at,id limit 1;end if;
 if legacy is not null then update public.payment_methods set code='iban',name='IBAN',provider='bank',enabled=(select bank_enabled from public.site_settings where id=true),verified=true where id=legacy;
 elsif exists(select 1 from public.site_settings where bank_enabled)then insert into public.payment_methods(code,name,provider,enabled,verified)values('iban','IBAN','bank',true,true);end if;
end$$;

create function public.bank_method_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_op='UPDATE'and old.provider='bank'and(new.provider<>'bank'or new.code<>'iban')then raise exception 'IBAN metodu možete sakriti ili ukloniti; vrsta se ne mijenja';end if;
 if new.provider='bank'and new.enabled is distinct from(select bank_enabled from public.site_settings where id=true)then raise exception 'IBAN uključite kroz postavke bankovne uplate';end if;return new;
end$$;
create trigger bank_method_guard before insert or update on public.payment_methods for each row execute function public.bank_method_guard();
create function public.sync_bank_method()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.bank_enabled then
  insert into public.payment_methods(code,name,provider,enabled,verified)values('iban','IBAN','bank',true,true)on conflict(code)do update set enabled=true,verified=true;
 else update public.payment_methods set enabled=false where provider='bank'and code='iban';end if;return new;
end$$;
create trigger sync_bank_method after update of bank_enabled on public.site_settings for each row execute function public.sync_bank_method();
create function public.removed_bank_method()returns trigger language plpgsql security definer set search_path=public as $$begin
 if old.provider='bank'then update public.site_settings set bank_enabled=false where id=true;end if;return old;
end$$;
create trigger removed_bank_method after delete on public.payment_methods for each row execute function public.removed_bank_method();
create function public.configure_bank_method(p_enabled boolean)returns void language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();
 if p_enabled is null then raise exception 'Odaberite uključivanje ili isključivanje IBAN-a';end if;
 if p_enabled and not exists(select 1 from public.business_settings where id=true and coalesce(trim(iban),'')<>''and coalesce(trim(payment_recipient),'')<>'')then raise exception 'Najprije spremite primatelja i valjani IBAN u odjeljku Podaci za uplatu';end if;
 insert into public.payment_methods(code,name,provider,enabled,verified)select 'iban','IBAN','bank',bank_enabled,true from public.site_settings where id=true on conflict(code)do nothing;
 update public.site_settings set bank_enabled=p_enabled where id=true;
end$$;
revoke all on function public.bank_method_guard(),public.sync_bank_method(),public.removed_bank_method(),public.configure_bank_method(boolean)from public,anon,authenticated;
grant execute on function public.configure_bank_method(boolean)to authenticated;
drop policy payment_methods_public on public.payment_methods;
create policy payment_methods_public on public.payment_methods for select to anon,authenticated using(enabled and(
 (provider='stripe'and(code in('visa','mastercard')or verified))or(provider='bank'and code='iban'and exists(select 1 from public.site_settings where bank_enabled and not maintenance))));
NOTIFY pgrst,'reload schema';

create or replace function public.checkout_options()returns jsonb language plpgsql stable security definer set search_path=public as $$
declare s public.site_settings;b public.business_settings;
begin
 perform public.assert_user();select * into s from public.site_settings where id=true;select * into b from public.business_settings where id=true;
 return jsonb_build_object('card',s.stripe_enabled and not s.maintenance,
 'google_pay',s.stripe_enabled and not s.maintenance and exists(select 1 from public.payment_methods where code='google_pay'and provider='stripe'and enabled and verified),
 'apple_pay',s.stripe_enabled and not s.maintenance and exists(select 1 from public.payment_methods where code='apple_pay'and provider='stripe'and enabled and verified),
 'bank',exists(select 1 from public.payment_methods where provider='bank'and code='iban'and enabled)and s.bank_enabled and not s.maintenance and coalesce(trim(b.iban),'')<>''and coalesce(trim(b.payment_recipient),'')<>'');
end$$;

NOTIFY pgrst,'reload schema';
$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'IBAN kartica povezana je s postavkama bankovne uplate. Postojeće ikone su sačuvane.'AS rezultat;

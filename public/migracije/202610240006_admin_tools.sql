-- FormaPoint: nadogradnja postojeće baze (migracije 001–005 moraju već postojati).
-- Otvorite Supabase SQL Editor, zalijepite cijelu datoteku i pokrenite jednom.
-- Čuva postojeće račune, uloge, narudžbe i uplate. Ne sadrži API ključeve ni lozinke.
BEGIN;
DO $fp_guard$
BEGIN
 IF to_regclass('public.orders') IS NULL OR to_regprocedure('public.sync_service_category()') IS NULL THEN
  RAISE EXCEPTION 'Nedostaje osnovna FormaPoint shema (migracije 001–005). Ova datoteka je samo nadogradnja.';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='site_settings' AND column_name='platform_name') THEN
  RAISE EXCEPTION 'Nadogradnja 202610240006 već je primijenjena. Nemojte je ponovno pokretati.';
 END IF;
END $fp_guard$;
-- Aditivna nadogradnja: administrativne kartice, CMS, portfolio i newsletter.
-- Ne mijenja postojeće cijene, narudžbe, korisničke uloge ili potvrđene uplate.
alter table public.site_settings
 add column platform_name text not null default 'FormaPoint' check(length(platform_name) between 2 and 80),
 add column contact_phone text,
 add column public_contact_email text,
 add column facebook_url text,
 add column instagram_url text,
 add column linkedin_url text,
 add column payment_icons jsonb not null default '{}' check(jsonb_typeof(payment_icons)='object'),
 add column cancellation_days integer check(cancellation_days between 0 and 365),
 add column final_payment_days integer check(final_payment_days between 1 and 365),
 add column policies_approved boolean not null default false;
alter table public.business_settings
 add column notification_email text,
 add column payment_recipient text,
 add column iban text,
 add column bank_name text,
 add column payment_phone text;
create function public.validate_site_settings() returns trigger language plpgsql set search_path=public as $$
declare value text; pair record;
begin
 foreach value in array array[new.facebook_url,new.instagram_url,new.linkedin_url]loop
  if value is not null and value<>'' and value !~ '^https://[^[:space:]]+$' then raise exception 'Poveznice moraju počinjati s https://';end if;
 end loop;
 if new.public_contact_email is not null and new.public_contact_email<>'' and new.public_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Neispravan javni e-mail';end if;
 for pair in select * from jsonb_each_text(new.payment_icons)loop
  if pair.key not in('visa','mastercard','apple_pay','google_pay','keks','aircash')or pair.value !~ '^https://[^[:space:]]+$'then raise exception 'Neispravna ikona plaćanja';end if;
 end loop;
 return new;
end$$;
create trigger validate_site_settings before insert or update on public.site_settings for each row execute function public.validate_site_settings();
create function public.validate_business_settings()returns trigger language plpgsql set search_path=public as $$declare chars text; digit text; i integer; rest integer:=0; begin
 new.iban:=upper(regexp_replace(new.iban,'[[:space:]]','','g'));
 if coalesce(new.iban,'')<>''then
 if new.iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'then raise exception 'Neispravan IBAN';end if;
 chars:=substr(new.iban,5)||substr(new.iban,1,4);
 for i in 1..length(chars)loop digit:=substr(chars,i,1);if digit ~ '[A-Z]'then digit:=(ascii(digit)-55)::text;end if;rest:=(rest*power(10,length(digit))::integer+digit::integer)%97;end loop;
 if rest<>1 then raise exception 'Neispravan IBAN';end if;end if;
 if new.notification_email is not null and new.notification_email<>'' and new.notification_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'then raise exception 'Neispravan e-mail za obavijesti';end if;
 if length(coalesce(new.iban,''))>34 or length(coalesce(new.payment_phone,''))>40 then raise exception 'Predugački podaci za uplatu';end if;return new;end$$;
create trigger validate_business_settings before insert or update on public.business_settings for each row execute function public.validate_business_settings();
alter table public.orders add column cancellation_deadline_at timestamptz,add column final_payment_window_days integer,add column final_payment_due_at timestamptz;
create function public.order_policy_snapshot()returns trigger language plpgsql security definer set search_path=public as $$declare s public.site_settings;begin
 if tg_op='INSERT'then select * into s from public.site_settings where id=true;if s.policies_approved then new.cancellation_deadline_at:=case when s.cancellation_days is not null then now()+make_interval(days=>s.cancellation_days)end;new.final_payment_window_days:=s.final_payment_days;end if;
 elsif new.status='final_pending'and old.status<>'final_pending'and new.final_payment_window_days is not null then new.final_payment_due_at:=now()+make_interval(days=>new.final_payment_window_days);end if;return new;end$$;
create trigger order_policy_snapshot before insert or update of status on public.orders for each row execute function public.order_policy_snapshot();
create table public.content_pages(
 id uuid primary key default gen_random_uuid(),slug text not null unique check(slug ~ '^[a-z0-9-]+$' and length(slug)<=100),title text not null check(length(title)between 2 and 150),
 content text not null check(length(content)between 10 and 100000),published boolean not null default false,is_legal boolean not null default false,approved_at timestamptz,approved_by uuid references auth.users,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(not(published and is_legal)or(approved_at is not null and approved_by is not null))
);
create function public.content_page_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 new.is_legal:=new.slug in('uvjeti-koristenja','pravila-privatnosti','kolacici','otkazivanje-i-povrati','prigovori');
 if tg_op='UPDATE'and new.content is distinct from old.content then new.approved_at:=null;new.approved_by:=null;end if;
 if new.published and new.is_legal then if not public.is_admin()or new.approved_by is distinct from auth.uid() then raise exception 'Pravni sadržaj zahtijeva izričito odobrenje administratora';end if;new.approved_at:=now();end if;
 new.updated_at:=now();return new;end$$;
create trigger content_page_guard before insert or update on public.content_pages for each row execute function public.content_page_guard();
create table public.portfolio_items(
 id uuid primary key default gen_random_uuid(),title text not null check(length(title)between 3 and 150),description text not null check(length(description)between 10 and 10000),
 pdf_url text check(pdf_url is null or pdf_url ~ '^https://[^[:space:]]+$'),file_path text unique,scan_status text not null default 'quarantined' check(scan_status in('quarantined','clean','rejected','linked')),
 publication_rights boolean not null default false,published boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(pdf_url is not null or file_path is not null),check(not published or(publication_rights and scan_status in('clean','linked')))
);
create function public.portfolio_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.file_path is null and new.pdf_url is not null then new.scan_status:='linked';
 elsif tg_op='UPDATE'and new.file_path is distinct from old.file_path then new.scan_status:='quarantined';new.published:=false;end if;
 new.updated_at:=now();return new;end$$;
create trigger portfolio_guard before insert or update on public.portfolio_items for each row execute function public.portfolio_guard();
-- Provjera skeniranih datoteka odvija se zasebnim RPC-om; direktna promjena na clean nije dopuštena.
create function public.review_portfolio_file(p_id uuid,p_result text,p_reason text)returns void language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();if p_result not in('clean','rejected')or length(trim(p_reason))<10 then raise exception 'Potreban je rezultat i obrazloženje stvarne provjere';end if;
 update public.portfolio_items set scan_status=p_result,published=false where id=p_id and file_path is not null;
 if not found then raise exception 'Datoteka nije pronađena';end if;
 insert into public.audit_logs(actor_id,action,entity_id,details)values(auth.uid(),'portfolio.security_review',p_id::text,jsonb_build_object('result',p_result,'reason',left(p_reason,500)));end$$;
create table public.newsletter_templates(
 id uuid primary key default gen_random_uuid(),name text not null check(length(name)between 2 and 150),subject text not null check(length(subject)between 3 and 150),html text not null check(length(html)between 10 and 100000),image_url text check(image_url is null or image_url ~ '^https://[^[:space:]]+$'),valid_from timestamptz,valid_until timestamptz,created_at timestamptz not null default now(),check(valid_until is null or valid_from is null or valid_until>valid_from)
);
create table public.newsletter_subscribers(
 id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users on delete cascade,email text not null,status text not null check(status in('pending','subscribed','unsubscribed')),confirmed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.newsletter_optouts(subscriber_id uuid primary key references public.newsletter_subscribers on delete cascade,token uuid not null unique default gen_random_uuid());
create table public.newsletter_campaigns(
 id uuid primary key default gen_random_uuid(),template_id uuid references public.newsletter_templates on delete set null,subject text not null check(length(subject)between 3 and 150),html text not null check(length(html)between 10 and 100000),status text not null default 'draft'check(status in('draft','queued','sending','sent','failed','cancelled')),created_at timestamptz not null default now()
);
create table public.newsletter_deliveries(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.newsletter_campaigns on delete cascade,subscriber_id uuid not null references public.newsletter_subscribers on delete cascade,status text not null default 'pending'check(status in('pending','processing','sent','failed','skipped')),attempts integer not null default 0,locked_at timestamptz,last_error text,sent_at timestamptz,created_at timestamptz not null default now(),unique(campaign_id,subscriber_id)
);
create index newsletter_delivery_queue on public.newsletter_deliveries(status,locked_at);
alter table public.promo_codes add column name text,add column banner boolean not null default false,add column customer_id uuid references auth.users;
create unique index one_active_discount_banner on public.promo_codes(banner)where banner and active;
-- Zadržati staru provjeru kupona i dodati ograničenje na točno određenog korisnika prije evidentiranja korištenja.
create function public.promo_customer_guard()returns trigger language plpgsql security definer set search_path=public as $$declare owner uuid;begin
 select customer_id into owner from public.promo_codes where id=new.promo_id;
 if owner is not null and owner<>new.user_id then raise exception 'Kupon nije namijenjen ovom korisniku';end if;return new;end$$;
create trigger promo_customer_guard before insert on public.promo_code_uses for each row execute function public.promo_customer_guard();
create function public.sync_newsletter_consent()returns trigger language plpgsql security definer set search_path=public as $$declare uid uuid;allowed boolean;mail text;confirmed timestamptz;sid uuid;begin
 uid:=new.id;select p.marketing_consent,u.email,u.email_confirmed_at into allowed,mail,confirmed from public.profiles p join auth.users u on u.id=p.id where p.id=uid;
 if mail is null then return new;end if;
 insert into public.newsletter_subscribers(user_id,email,status,confirmed_at)values(uid,mail,case when not allowed then 'unsubscribed'when confirmed is null then 'pending'else 'subscribed'end,confirmed)
 on conflict(user_id)do update set email=excluded.email,status=excluded.status,confirmed_at=excluded.confirmed_at,updated_at=now()returning id into sid;
 insert into public.newsletter_optouts(subscriber_id)values(sid)on conflict do nothing;return new;end$$;
create trigger newsletter_profile after insert or update of marketing_consent on public.profiles for each row execute function public.sync_newsletter_consent();
create trigger newsletter_auth after update of email,email_confirmed_at on auth.users for each row execute function public.sync_newsletter_consent();
insert into public.newsletter_subscribers(user_id,email,status,confirmed_at)
 select p.id,u.email,case when u.email_confirmed_at is null then 'pending'else 'subscribed'end,u.email_confirmed_at from public.profiles p join auth.users u on u.id=p.id where p.marketing_consent and u.email is not null;
insert into public.newsletter_optouts(subscriber_id)select id from public.newsletter_subscribers;
create function public.unsubscribe_newsletter(p_token uuid)returns boolean language plpgsql security definer set search_path=public as $$declare sid uuid;uid uuid;begin
 select subscriber_id into sid from public.newsletter_optouts where token=p_token;if sid is null then return false;end if;
 update public.newsletter_subscribers set status='unsubscribed',updated_at=now()where id=sid returning user_id into uid;
 update public.profiles set marketing_consent=false where id=uid;return true;end$$;
create function public.admin_users(p_search text default '',p_offset integer default 0,p_limit integer default 25)
 returns table(id uuid,first_name text,last_name text,email text,phone text,roles text[],created_at timestamptz,order_count bigint)
 language plpgsql security definer set search_path=public as $$begin perform public.assert_admin();
 return query select p.id,p.first_name,p.last_name,u.email::text,p.phone,array(select r.role from public.user_roles r where r.user_id=p.id),p.created_at,(select count(*)from public.orders o where o.user_id=p.id)
 from public.profiles p join auth.users u on u.id=p.id where p.first_name||' '||p.last_name||' '||coalesce(u.email,'') ilike '%'||left(p_search,150)||'%' order by p.created_at desc,p.id offset greatest(0,p_offset)limit least(100,greatest(1,p_limit));end$$;
create function public.admin_summary()returns jsonb language plpgsql security definer set search_path=public as $$begin perform public.assert_admin();return jsonb_build_object(
 'users',(select count(*)from public.profiles),'revenue_month',(select coalesce(sum(greatest(0,amount_cents-refunded_cents)),0)from public.payments where status in('succeeded','partially_refunded','refunded')and created_at>=date_trunc('month',now()at time zone'Europe/Zagreb')at time zone'Europe/Zagreb'),'messages_month',(select count(*)from public.order_messages where not internal and created_at>=date_trunc('month',now()at time zone'Europe/Zagreb')at time zone'Europe/Zagreb'),
 'inquiries_week',(select count(*)from public.contact_requests where created_at>=now()-interval'7 days')+(select count(*)from public.support_tickets where created_at>=now()-interval'7 days'));end$$;
create function public.queue_newsletter(p_campaign uuid)returns integer language plpgsql security definer set search_path=public as $$declare c public.newsletter_campaigns;n integer;begin
 perform public.assert_admin();perform public.rate_limit('newsletter:'||auth.uid(),10,3600);select * into c from public.newsletter_campaigns where id=p_campaign for update;
 if not found or c.status<>'draft'then raise exception 'Kampanja nije u nacrtu';end if;
 insert into public.newsletter_deliveries(campaign_id,subscriber_id)select c.id,s.id from public.newsletter_subscribers s join public.profiles p on p.id=s.user_id where s.status='subscribed'and s.confirmed_at is not null and p.marketing_consent;
 get diagnostics n=row_count;if n=0 then raise exception 'Nema potvrđenih pretplatnika s privolom';end if;
 update public.newsletter_campaigns set status='queued'where id=c.id;return n;end$$;
create function public.claim_newsletter(p_limit integer default 20)returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;begin
 update public.newsletter_deliveries set status='failed',last_error='Prekinuto slanje nakon najvećeg broja pokušaja.'where status='processing'and attempts>=5 and locked_at<now()-interval'10 minutes';
 with claimed as(update public.newsletter_deliveries set status='processing',attempts=attempts+1,locked_at=now()
 where id in(select d.id from public.newsletter_deliveries d join public.newsletter_campaigns c on c.id=d.campaign_id where c.status in('queued','sending')and(d.status in('pending','failed')or(d.status='processing'and d.locked_at<now()-interval'10 minutes'))and d.attempts<5 and(d.locked_at is null or d.locked_at<now()-interval'5 minutes')order by d.created_at for update of d skip locked limit least(20,greatest(1,p_limit)))returning *)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'campaign_id',d.campaign_id,'email',s.email,'allowed',s.status='subscribed'and p.marketing_consent and s.confirmed_at is not null,'token',t.token,'subject',c.subject,'html',c.html)),'[]'::jsonb)into result from claimed d join public.newsletter_campaigns c on c.id=d.campaign_id join public.newsletter_subscribers s on s.id=d.subscriber_id join public.profiles p on p.id=s.user_id join public.newsletter_optouts t on t.subscriber_id=s.id;
 update public.newsletter_campaigns set status='sending'where status='queued'and id in(select campaign_id from public.newsletter_deliveries where status='processing');return result;end$$;
create function public.newsletter_progress()returns trigger language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from public.newsletter_deliveries where campaign_id=new.campaign_id and(status in('pending','processing')or(status='failed'and attempts<5)))then
 update public.newsletter_campaigns set status=case when exists(select 1 from public.newsletter_deliveries where campaign_id=new.campaign_id and status='failed')then 'failed'else 'sent'end where id=new.campaign_id and status in('queued','sending');end if;return new;end$$;
create trigger newsletter_progress after update of status on public.newsletter_deliveries for each row execute function public.newsletter_progress();
-- Javne objave i sve ostalo zadano privatno; administrator mora biti potvrđen u bazi.
do $$declare t text;begin foreach t in array array['content_pages','portfolio_items','newsletter_templates','newsletter_subscribers','newsletter_optouts','newsletter_campaigns','newsletter_deliveries']loop
 execute format('alter table public.%I enable row level security',t);if t<>'newsletter_optouts'then execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_change()',t);end if;
 end loop;
 foreach t in array array['content_pages','portfolio_items','newsletter_templates']loop execute format('create policy admin_manage on public.%I for all to authenticated using(public.is_admin())with check(public.is_admin())',t);end loop;
 foreach t in array array['newsletter_subscribers','newsletter_campaigns','newsletter_deliveries']loop execute format('create policy admin_read on public.%I for select to authenticated using(public.is_admin())',t);end loop;
end$$;
create policy published_pages on public.content_pages for select to anon,authenticated using(published and(not is_legal or approved_at is not null));
create policy published_portfolio on public.portfolio_items for select to anon,authenticated using(published and publication_rights and scan_status in('clean','linked'));
create policy campaign_draft_insert on public.newsletter_campaigns for insert to authenticated with check(public.is_admin()and status='draft');
create policy campaign_draft_update on public.newsletter_campaigns for update to authenticated using(public.is_admin()and status='draft')with check(public.is_admin()and status='draft');
create policy campaign_draft_delete on public.newsletter_campaigns for delete to authenticated using(public.is_admin()and status='draft');
-- Supabase može imati zadane ALL grantove za nove tablice. Zatvoriti ih prije prava po stupcima.
revoke all on public.content_pages,public.portfolio_items,public.newsletter_templates,public.newsletter_subscribers,public.newsletter_optouts,public.newsletter_campaigns,public.newsletter_deliveries from anon,authenticated;
grant select,insert,update,delete on public.content_pages,public.newsletter_templates to authenticated;
grant select,delete on public.portfolio_items to authenticated;
grant insert(title,description,pdf_url,publication_rights,published),update(title,description,pdf_url,publication_rights,published)on public.portfolio_items to authenticated;
grant select on public.content_pages,public.portfolio_items to anon;
grant select on public.newsletter_subscribers,public.newsletter_deliveries to authenticated;
grant select,insert,update,delete on public.newsletter_campaigns to authenticated;
grant all on public.content_pages,public.portfolio_items,public.newsletter_templates,public.newsletter_subscribers,public.newsletter_optouts,public.newsletter_campaigns,public.newsletter_deliveries to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('portfolio-files','portfolio-files',false,20971520,array['application/pdf']);
revoke all on function public.validate_site_settings(),public.validate_business_settings(),public.order_policy_snapshot(),public.content_page_guard(),public.portfolio_guard(),public.promo_customer_guard(),public.sync_newsletter_consent(),public.newsletter_progress(),public.claim_newsletter(integer),public.admin_users(text,integer,integer),public.admin_summary(),public.queue_newsletter(uuid),public.review_portfolio_file(uuid,text,text),public.unsubscribe_newsletter(uuid)from public,anon,authenticated;
grant execute on function public.admin_users(text,integer,integer),public.admin_summary(),public.queue_newsletter(uuid),public.review_portfolio_file(uuid,text,text)to authenticated;
grant execute on function public.unsubscribe_newsletter(uuid)to anon,authenticated;
grant execute on function public.claim_newsletter(integer)to service_role;

create function public.discount_banner()returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('name',coalesce(name,'Posebna ponuda'),'code',code,'kind',kind,'value',value,'expires_at',expires_at)
 from public.promo_codes where banner and active and expires_at>now()and(select count(*)from public.promo_code_uses u where u.promo_id=promo_codes.id)<max_uses and not exists(select 1 from public.promo_code_uses u where u.promo_id=promo_codes.id and u.user_id=auth.uid())and(customer_id is null or customer_id=auth.uid())limit 1$$;
revoke all on function public.discount_banner()from public;grant execute on function public.discount_banner()to anon,authenticated;
-- Odabir bannera je jedna transakcija; promjene se serijaliziraju i kod istodobnog klika.
create function public.set_discount_banner(p_id uuid,p_enabled boolean)returns void language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();perform pg_advisory_xact_lock(240006);
 if not exists(select 1 from public.promo_codes where id=p_id)then raise exception 'Kupon nije pronađen';end if;
 if p_enabled then update public.promo_codes set banner=false where banner;end if;
 update public.promo_codes set banner=p_enabled where id=p_id;
end$$;
revoke all on function public.set_discount_banner(uuid,boolean)from public;grant execute on function public.set_discount_banner(uuid,boolean)to authenticated;

NOTIFY pgrst, 'reload schema';

CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610240006','admin_tools',ARRAY[$fp_source$-- Aditivna nadogradnja: administrativne kartice, CMS, portfolio i newsletter.
-- Ne mijenja postojeće cijene, narudžbe, korisničke uloge ili potvrđene uplate.
alter table public.site_settings
 add column platform_name text not null default 'FormaPoint' check(length(platform_name) between 2 and 80),
 add column contact_phone text,
 add column public_contact_email text,
 add column facebook_url text,
 add column instagram_url text,
 add column linkedin_url text,
 add column payment_icons jsonb not null default '{}' check(jsonb_typeof(payment_icons)='object'),
 add column cancellation_days integer check(cancellation_days between 0 and 365),
 add column final_payment_days integer check(final_payment_days between 1 and 365),
 add column policies_approved boolean not null default false;
alter table public.business_settings
 add column notification_email text,
 add column payment_recipient text,
 add column iban text,
 add column bank_name text,
 add column payment_phone text;
create function public.validate_site_settings() returns trigger language plpgsql set search_path=public as $$
declare value text; pair record;
begin
 foreach value in array array[new.facebook_url,new.instagram_url,new.linkedin_url]loop
  if value is not null and value<>'' and value !~ '^https://[^[:space:]]+$' then raise exception 'Poveznice moraju počinjati s https://';end if;
 end loop;
 if new.public_contact_email is not null and new.public_contact_email<>'' and new.public_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Neispravan javni e-mail';end if;
 for pair in select * from jsonb_each_text(new.payment_icons)loop
  if pair.key not in('visa','mastercard','apple_pay','google_pay','keks','aircash')or pair.value !~ '^https://[^[:space:]]+$'then raise exception 'Neispravna ikona plaćanja';end if;
 end loop;
 return new;
end$$;
create trigger validate_site_settings before insert or update on public.site_settings for each row execute function public.validate_site_settings();
create function public.validate_business_settings()returns trigger language plpgsql set search_path=public as $$declare chars text; digit text; i integer; rest integer:=0; begin
 new.iban:=upper(regexp_replace(new.iban,'[[:space:]]','','g'));
 if coalesce(new.iban,'')<>''then
 if new.iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'then raise exception 'Neispravan IBAN';end if;
 chars:=substr(new.iban,5)||substr(new.iban,1,4);
 for i in 1..length(chars)loop digit:=substr(chars,i,1);if digit ~ '[A-Z]'then digit:=(ascii(digit)-55)::text;end if;rest:=(rest*power(10,length(digit))::integer+digit::integer)%97;end loop;
 if rest<>1 then raise exception 'Neispravan IBAN';end if;end if;
 if new.notification_email is not null and new.notification_email<>'' and new.notification_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'then raise exception 'Neispravan e-mail za obavijesti';end if;
 if length(coalesce(new.iban,''))>34 or length(coalesce(new.payment_phone,''))>40 then raise exception 'Predugački podaci za uplatu';end if;return new;end$$;
create trigger validate_business_settings before insert or update on public.business_settings for each row execute function public.validate_business_settings();
alter table public.orders add column cancellation_deadline_at timestamptz,add column final_payment_window_days integer,add column final_payment_due_at timestamptz;
create function public.order_policy_snapshot()returns trigger language plpgsql security definer set search_path=public as $$declare s public.site_settings;begin
 if tg_op='INSERT'then select * into s from public.site_settings where id=true;if s.policies_approved then new.cancellation_deadline_at:=case when s.cancellation_days is not null then now()+make_interval(days=>s.cancellation_days)end;new.final_payment_window_days:=s.final_payment_days;end if;
 elsif new.status='final_pending'and old.status<>'final_pending'and new.final_payment_window_days is not null then new.final_payment_due_at:=now()+make_interval(days=>new.final_payment_window_days);end if;return new;end$$;
create trigger order_policy_snapshot before insert or update of status on public.orders for each row execute function public.order_policy_snapshot();
create table public.content_pages(
 id uuid primary key default gen_random_uuid(),slug text not null unique check(slug ~ '^[a-z0-9-]+$' and length(slug)<=100),title text not null check(length(title)between 2 and 150),
 content text not null check(length(content)between 10 and 100000),published boolean not null default false,is_legal boolean not null default false,approved_at timestamptz,approved_by uuid references auth.users,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(not(published and is_legal)or(approved_at is not null and approved_by is not null))
);
create function public.content_page_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 new.is_legal:=new.slug in('uvjeti-koristenja','pravila-privatnosti','kolacici','otkazivanje-i-povrati','prigovori');
 if tg_op='UPDATE'and new.content is distinct from old.content then new.approved_at:=null;new.approved_by:=null;end if;
 if new.published and new.is_legal then if not public.is_admin()or new.approved_by is distinct from auth.uid() then raise exception 'Pravni sadržaj zahtijeva izričito odobrenje administratora';end if;new.approved_at:=now();end if;
 new.updated_at:=now();return new;end$$;
create trigger content_page_guard before insert or update on public.content_pages for each row execute function public.content_page_guard();
create table public.portfolio_items(
 id uuid primary key default gen_random_uuid(),title text not null check(length(title)between 3 and 150),description text not null check(length(description)between 10 and 10000),
 pdf_url text check(pdf_url is null or pdf_url ~ '^https://[^[:space:]]+$'),file_path text unique,scan_status text not null default 'quarantined' check(scan_status in('quarantined','clean','rejected','linked')),
 publication_rights boolean not null default false,published boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(pdf_url is not null or file_path is not null),check(not published or(publication_rights and scan_status in('clean','linked')))
);
create function public.portfolio_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.file_path is null and new.pdf_url is not null then new.scan_status:='linked';
 elsif tg_op='UPDATE'and new.file_path is distinct from old.file_path then new.scan_status:='quarantined';new.published:=false;end if;
 new.updated_at:=now();return new;end$$;
create trigger portfolio_guard before insert or update on public.portfolio_items for each row execute function public.portfolio_guard();
-- Provjera skeniranih datoteka odvija se zasebnim RPC-om; direktna promjena na clean nije dopuštena.
create function public.review_portfolio_file(p_id uuid,p_result text,p_reason text)returns void language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();if p_result not in('clean','rejected')or length(trim(p_reason))<10 then raise exception 'Potreban je rezultat i obrazloženje stvarne provjere';end if;
 update public.portfolio_items set scan_status=p_result,published=false where id=p_id and file_path is not null;
 if not found then raise exception 'Datoteka nije pronađena';end if;
 insert into public.audit_logs(actor_id,action,entity_id,details)values(auth.uid(),'portfolio.security_review',p_id::text,jsonb_build_object('result',p_result,'reason',left(p_reason,500)));end$$;
create table public.newsletter_templates(
 id uuid primary key default gen_random_uuid(),name text not null check(length(name)between 2 and 150),subject text not null check(length(subject)between 3 and 150),html text not null check(length(html)between 10 and 100000),image_url text check(image_url is null or image_url ~ '^https://[^[:space:]]+$'),valid_from timestamptz,valid_until timestamptz,created_at timestamptz not null default now(),check(valid_until is null or valid_from is null or valid_until>valid_from)
);
create table public.newsletter_subscribers(
 id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users on delete cascade,email text not null,status text not null check(status in('pending','subscribed','unsubscribed')),confirmed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.newsletter_optouts(subscriber_id uuid primary key references public.newsletter_subscribers on delete cascade,token uuid not null unique default gen_random_uuid());
create table public.newsletter_campaigns(
 id uuid primary key default gen_random_uuid(),template_id uuid references public.newsletter_templates on delete set null,subject text not null check(length(subject)between 3 and 150),html text not null check(length(html)between 10 and 100000),status text not null default 'draft'check(status in('draft','queued','sending','sent','failed','cancelled')),created_at timestamptz not null default now()
);
create table public.newsletter_deliveries(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.newsletter_campaigns on delete cascade,subscriber_id uuid not null references public.newsletter_subscribers on delete cascade,status text not null default 'pending'check(status in('pending','processing','sent','failed','skipped')),attempts integer not null default 0,locked_at timestamptz,last_error text,sent_at timestamptz,created_at timestamptz not null default now(),unique(campaign_id,subscriber_id)
);
create index newsletter_delivery_queue on public.newsletter_deliveries(status,locked_at);
alter table public.promo_codes add column name text,add column banner boolean not null default false,add column customer_id uuid references auth.users;
create unique index one_active_discount_banner on public.promo_codes(banner)where banner and active;
-- Zadržati staru provjeru kupona i dodati ograničenje na točno određenog korisnika prije evidentiranja korištenja.
create function public.promo_customer_guard()returns trigger language plpgsql security definer set search_path=public as $$declare owner uuid;begin
 select customer_id into owner from public.promo_codes where id=new.promo_id;
 if owner is not null and owner<>new.user_id then raise exception 'Kupon nije namijenjen ovom korisniku';end if;return new;end$$;
create trigger promo_customer_guard before insert on public.promo_code_uses for each row execute function public.promo_customer_guard();
create function public.sync_newsletter_consent()returns trigger language plpgsql security definer set search_path=public as $$declare uid uuid;allowed boolean;mail text;confirmed timestamptz;sid uuid;begin
 uid:=new.id;select p.marketing_consent,u.email,u.email_confirmed_at into allowed,mail,confirmed from public.profiles p join auth.users u on u.id=p.id where p.id=uid;
 if mail is null then return new;end if;
 insert into public.newsletter_subscribers(user_id,email,status,confirmed_at)values(uid,mail,case when not allowed then 'unsubscribed'when confirmed is null then 'pending'else 'subscribed'end,confirmed)
 on conflict(user_id)do update set email=excluded.email,status=excluded.status,confirmed_at=excluded.confirmed_at,updated_at=now()returning id into sid;
 insert into public.newsletter_optouts(subscriber_id)values(sid)on conflict do nothing;return new;end$$;
create trigger newsletter_profile after insert or update of marketing_consent on public.profiles for each row execute function public.sync_newsletter_consent();
create trigger newsletter_auth after update of email,email_confirmed_at on auth.users for each row execute function public.sync_newsletter_consent();
insert into public.newsletter_subscribers(user_id,email,status,confirmed_at)
 select p.id,u.email,case when u.email_confirmed_at is null then 'pending'else 'subscribed'end,u.email_confirmed_at from public.profiles p join auth.users u on u.id=p.id where p.marketing_consent and u.email is not null;
insert into public.newsletter_optouts(subscriber_id)select id from public.newsletter_subscribers;
create function public.unsubscribe_newsletter(p_token uuid)returns boolean language plpgsql security definer set search_path=public as $$declare sid uuid;uid uuid;begin
 select subscriber_id into sid from public.newsletter_optouts where token=p_token;if sid is null then return false;end if;
 update public.newsletter_subscribers set status='unsubscribed',updated_at=now()where id=sid returning user_id into uid;
 update public.profiles set marketing_consent=false where id=uid;return true;end$$;
create function public.admin_users(p_search text default '',p_offset integer default 0,p_limit integer default 25)
 returns table(id uuid,first_name text,last_name text,email text,phone text,roles text[],created_at timestamptz,order_count bigint)
 language plpgsql security definer set search_path=public as $$begin perform public.assert_admin();
 return query select p.id,p.first_name,p.last_name,u.email::text,p.phone,array(select r.role from public.user_roles r where r.user_id=p.id),p.created_at,(select count(*)from public.orders o where o.user_id=p.id)
 from public.profiles p join auth.users u on u.id=p.id where p.first_name||' '||p.last_name||' '||coalesce(u.email,'') ilike '%'||left(p_search,150)||'%' order by p.created_at desc,p.id offset greatest(0,p_offset)limit least(100,greatest(1,p_limit));end$$;
create function public.admin_summary()returns jsonb language plpgsql security definer set search_path=public as $$begin perform public.assert_admin();return jsonb_build_object(
 'users',(select count(*)from public.profiles),'revenue_month',(select coalesce(sum(greatest(0,amount_cents-refunded_cents)),0)from public.payments where status in('succeeded','partially_refunded','refunded')and created_at>=date_trunc('month',now()at time zone'Europe/Zagreb')at time zone'Europe/Zagreb'),'messages_month',(select count(*)from public.order_messages where not internal and created_at>=date_trunc('month',now()at time zone'Europe/Zagreb')at time zone'Europe/Zagreb'),
 'inquiries_week',(select count(*)from public.contact_requests where created_at>=now()-interval'7 days')+(select count(*)from public.support_tickets where created_at>=now()-interval'7 days'));end$$;
create function public.queue_newsletter(p_campaign uuid)returns integer language plpgsql security definer set search_path=public as $$declare c public.newsletter_campaigns;n integer;begin
 perform public.assert_admin();perform public.rate_limit('newsletter:'||auth.uid(),10,3600);select * into c from public.newsletter_campaigns where id=p_campaign for update;
 if not found or c.status<>'draft'then raise exception 'Kampanja nije u nacrtu';end if;
 insert into public.newsletter_deliveries(campaign_id,subscriber_id)select c.id,s.id from public.newsletter_subscribers s join public.profiles p on p.id=s.user_id where s.status='subscribed'and s.confirmed_at is not null and p.marketing_consent;
 get diagnostics n=row_count;if n=0 then raise exception 'Nema potvrđenih pretplatnika s privolom';end if;
 update public.newsletter_campaigns set status='queued'where id=c.id;return n;end$$;
create function public.claim_newsletter(p_limit integer default 20)returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;begin
 update public.newsletter_deliveries set status='failed',last_error='Prekinuto slanje nakon najvećeg broja pokušaja.'where status='processing'and attempts>=5 and locked_at<now()-interval'10 minutes';
 with claimed as(update public.newsletter_deliveries set status='processing',attempts=attempts+1,locked_at=now()
 where id in(select d.id from public.newsletter_deliveries d join public.newsletter_campaigns c on c.id=d.campaign_id where c.status in('queued','sending')and(d.status in('pending','failed')or(d.status='processing'and d.locked_at<now()-interval'10 minutes'))and d.attempts<5 and(d.locked_at is null or d.locked_at<now()-interval'5 minutes')order by d.created_at for update of d skip locked limit least(20,greatest(1,p_limit)))returning *)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'campaign_id',d.campaign_id,'email',s.email,'allowed',s.status='subscribed'and p.marketing_consent and s.confirmed_at is not null,'token',t.token,'subject',c.subject,'html',c.html)),'[]'::jsonb)into result from claimed d join public.newsletter_campaigns c on c.id=d.campaign_id join public.newsletter_subscribers s on s.id=d.subscriber_id join public.profiles p on p.id=s.user_id join public.newsletter_optouts t on t.subscriber_id=s.id;
 update public.newsletter_campaigns set status='sending'where status='queued'and id in(select campaign_id from public.newsletter_deliveries where status='processing');return result;end$$;
create function public.newsletter_progress()returns trigger language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from public.newsletter_deliveries where campaign_id=new.campaign_id and(status in('pending','processing')or(status='failed'and attempts<5)))then
 update public.newsletter_campaigns set status=case when exists(select 1 from public.newsletter_deliveries where campaign_id=new.campaign_id and status='failed')then 'failed'else 'sent'end where id=new.campaign_id and status in('queued','sending');end if;return new;end$$;
create trigger newsletter_progress after update of status on public.newsletter_deliveries for each row execute function public.newsletter_progress();
-- Javne objave i sve ostalo zadano privatno; administrator mora biti potvrđen u bazi.
do $$declare t text;begin foreach t in array array['content_pages','portfolio_items','newsletter_templates','newsletter_subscribers','newsletter_optouts','newsletter_campaigns','newsletter_deliveries']loop
 execute format('alter table public.%I enable row level security',t);if t<>'newsletter_optouts'then execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_change()',t);end if;
 end loop;
 foreach t in array array['content_pages','portfolio_items','newsletter_templates']loop execute format('create policy admin_manage on public.%I for all to authenticated using(public.is_admin())with check(public.is_admin())',t);end loop;
 foreach t in array array['newsletter_subscribers','newsletter_campaigns','newsletter_deliveries']loop execute format('create policy admin_read on public.%I for select to authenticated using(public.is_admin())',t);end loop;
end$$;
create policy published_pages on public.content_pages for select to anon,authenticated using(published and(not is_legal or approved_at is not null));
create policy published_portfolio on public.portfolio_items for select to anon,authenticated using(published and publication_rights and scan_status in('clean','linked'));
create policy campaign_draft_insert on public.newsletter_campaigns for insert to authenticated with check(public.is_admin()and status='draft');
create policy campaign_draft_update on public.newsletter_campaigns for update to authenticated using(public.is_admin()and status='draft')with check(public.is_admin()and status='draft');
create policy campaign_draft_delete on public.newsletter_campaigns for delete to authenticated using(public.is_admin()and status='draft');
-- Supabase može imati zadane ALL grantove za nove tablice. Zatvoriti ih prije prava po stupcima.
revoke all on public.content_pages,public.portfolio_items,public.newsletter_templates,public.newsletter_subscribers,public.newsletter_optouts,public.newsletter_campaigns,public.newsletter_deliveries from anon,authenticated;
grant select,insert,update,delete on public.content_pages,public.newsletter_templates to authenticated;
grant select,delete on public.portfolio_items to authenticated;
grant insert(title,description,pdf_url,publication_rights,published),update(title,description,pdf_url,publication_rights,published)on public.portfolio_items to authenticated;
grant select on public.content_pages,public.portfolio_items to anon;
grant select on public.newsletter_subscribers,public.newsletter_deliveries to authenticated;
grant select,insert,update,delete on public.newsletter_campaigns to authenticated;
grant all on public.content_pages,public.portfolio_items,public.newsletter_templates,public.newsletter_subscribers,public.newsletter_optouts,public.newsletter_campaigns,public.newsletter_deliveries to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('portfolio-files','portfolio-files',false,20971520,array['application/pdf']);
revoke all on function public.validate_site_settings(),public.validate_business_settings(),public.order_policy_snapshot(),public.content_page_guard(),public.portfolio_guard(),public.promo_customer_guard(),public.sync_newsletter_consent(),public.newsletter_progress(),public.claim_newsletter(integer),public.admin_users(text,integer,integer),public.admin_summary(),public.queue_newsletter(uuid),public.review_portfolio_file(uuid,text,text),public.unsubscribe_newsletter(uuid)from public,anon,authenticated;
grant execute on function public.admin_users(text,integer,integer),public.admin_summary(),public.queue_newsletter(uuid),public.review_portfolio_file(uuid,text,text)to authenticated;
grant execute on function public.unsubscribe_newsletter(uuid)to anon,authenticated;
grant execute on function public.claim_newsletter(integer)to service_role;

create function public.discount_banner()returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('name',coalesce(name,'Posebna ponuda'),'code',code,'kind',kind,'value',value,'expires_at',expires_at)
 from public.promo_codes where banner and active and expires_at>now()and(select count(*)from public.promo_code_uses u where u.promo_id=promo_codes.id)<max_uses and not exists(select 1 from public.promo_code_uses u where u.promo_id=promo_codes.id and u.user_id=auth.uid())and(customer_id is null or customer_id=auth.uid())limit 1$$;
revoke all on function public.discount_banner()from public;grant execute on function public.discount_banner()to anon,authenticated;
-- Odabir bannera je jedna transakcija; promjene se serijaliziraju i kod istodobnog klika.
create function public.set_discount_banner(p_id uuid,p_enabled boolean)returns void language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();perform pg_advisory_xact_lock(240006);
 if not exists(select 1 from public.promo_codes where id=p_id)then raise exception 'Kupon nije pronađen';end if;
 if p_enabled then update public.promo_codes set banner=false where banner;end if;
 update public.promo_codes set banner=p_enabled where id=p_id;
end$$;
revoke all on function public.set_discount_banner(uuid,boolean)from public;grant execute on function public.set_discount_banner(uuid,boolean)to authenticated;

NOTIFY pgrst, 'reload schema';
$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'FormaPoint nadogradnja 202610240006 uspješno je primijenjena.' AS rezultat;

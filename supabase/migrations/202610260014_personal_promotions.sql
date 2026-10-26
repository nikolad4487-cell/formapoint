alter table public.promo_codes add column starts_at timestamptz;
update public.promo_codes set starts_at=created_at;
alter table public.promo_codes alter column starts_at set default now(),alter column starts_at set not null;
create table public.promotion_campaigns(
 id uuid primary key,name text not null,occasion text not null check(occasion in('christmas','birthday','easter','custom')),
 kind text not null check(kind in('percent','fixed')),value integer not null check(value>0),
 subject text not null,message text not null,image_url text not null,starts_at timestamptz not null,expires_at timestamptz not null,
 request_hash text not null,created_by uuid not null references auth.users,created_at timestamptz not null default now(),
 check(expires_at>starts_at),check(kind<>'percent'or value<=100)
);
create table public.promotion_deliveries(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.promotion_campaigns,
 user_id uuid not null references auth.users,promo_id uuid references public.promo_codes on delete set null,
 code text not null,recipient_name text not null,email text not null,
 status text not null default 'pending'check(status in('pending','processing','sent','failed','skipped')),
 attempts integer not null default 0,claim_token uuid,locked_at timestamptz,first_attempt_at timestamptz,
 next_attempt_at timestamptz not null default now(),sent_at timestamptz,provider_id text,last_error text,created_at timestamptz not null default now(),unique(campaign_id,user_id)
);
create index promotion_queue on public.promotion_deliveries(status,locked_at);
alter table public.promotion_campaigns enable row level security;
alter table public.promotion_deliveries enable row level security;
revoke all on public.promotion_campaigns,public.promotion_deliveries from anon,authenticated;
grant select on public.promotion_campaigns,public.promotion_deliveries to authenticated;
grant all on public.promotion_campaigns,public.promotion_deliveries to service_role;
create policy admin_read on public.promotion_campaigns for select to authenticated using(public.is_admin());
create policy admin_read on public.promotion_deliveries for select to authenticated using(public.is_admin());

create function public.create_personal_promotion(p_request uuid,p_name text,p_occasion text,p_kind text,p_value integer,p_subject text,p_message text,p_image_url text,p_users uuid[] default null,p_starts timestamptz default null,p_expires timestamptz default null)returns uuid
language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.assert_user();v_start timestamptz:=coalesce(p_starts,now());v_end timestamptz:=coalesce(p_expires,now()+interval'30 days');fingerprint text;old_hash text;r record;coupon uuid;v_code text;n integer:=0;
begin
 perform public.assert_admin();
 if p_request is null or length(trim(p_name))not between 2 and 150 or length(trim(p_subject))not between 2 and 150 or length(trim(p_message))not between 10 and 5000 or p_occasion not in('christmas','birthday','easter','custom')or p_kind not in('percent','fixed')or p_value is null or p_value<1 or(p_kind='percent'and p_value>100)or p_value>100000000 then raise exception 'Provjerite naziv, poruku i iznos promocije';end if;
 if p_image_url is null or length(p_image_url)>2000 or p_image_url!~'^https://[^[:space:]]+$'then raise exception 'Odaberite sliku promocije';end if;
 if v_end<=v_start or v_end<=now()then raise exception 'Završni datum mora biti nakon početnog datuma i u budućnosti';end if;
 if p_users is not null and(cardinality(p_users)=0 or cardinality(p_users)>1000)then raise exception 'Odaberite od jednog do 1000 korisnika';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(trim(p_name),p_occasion,p_kind,p_value,trim(p_subject),trim(p_message),p_image_url,(select array_agg(distinct x order by x)from unnest(p_users)x),p_starts,p_expires)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('personal-promotion:'||p_request,0));
 select request_hash into old_hash from public.promotion_campaigns where id=p_request;
 if found then if old_hash<>fingerprint then raise exception 'Ponovljeni zahtjev sadrži drugačije podatke. Otvorite novu promociju.';end if;return p_request;end if;
 perform public.rate_limit('personal-promotion:'||actor,20,3600);
 if(select count(*)from public.profiles p join auth.users u on u.id=p.id where(p_users is null or p.id=any(p_users))and coalesce(nullif(u.email,''),p.contact_email)is not null)>1000 then raise exception 'Promocija može obuhvatiti najviše 1000 korisnika';end if;
 insert into public.promotion_campaigns(id,name,occasion,kind,value,subject,message,image_url,starts_at,expires_at,request_hash,created_by)values(p_request,trim(p_name),p_occasion,p_kind,p_value,trim(p_subject),trim(p_message),p_image_url,v_start,v_end,fingerprint,actor);
 for r in select p.id,p.first_name,p.last_name,coalesce(nullif(u.email,''),p.contact_email)as mail,p.marketing_consent,u.email_confirmed_at,ns.status as subscription
 from public.profiles p join auth.users u on u.id=p.id left join public.newsletter_subscribers ns on ns.user_id=p.id
 where(p_users is null or p.id=any(p_users))and coalesce(nullif(u.email,''),p.contact_email)is not null order by p.id loop
  n:=n+1;v_code:=upper(case p_occasion when'christmas'then'BOZIC'when'birthday'then'RODJENDAN'when'easter'then'USKRS'else'POKLON'end||'-'||left(replace(gen_random_uuid()::text,'-',''),20));
  insert into public.promo_codes(name,code,kind,value,max_uses,starts_at,expires_at,customer_id)values(trim(p_name),v_code,p_kind,p_value,1,v_start,v_end,r.id)returning id into coupon;
  insert into public.promotion_deliveries(campaign_id,user_id,promo_id,code,recipient_name,email,status,last_error)values(p_request,r.id,coupon,v_code,coalesce(nullif(trim(r.first_name),''),'korisniče'),r.mail,
   case when r.marketing_consent and r.email_confirmed_at is not null and r.subscription='subscribed'then'pending'else'skipped'end,
   case when r.marketing_consent and r.email_confirmed_at is not null and r.subscription='subscribed'then null else'Korisnik nema uključene promotivne poruke ili potvrđenu adresu.'end);
 end loop;
 if n=0 then raise exception 'Nema odabranih korisnika s kontaktnim e-mailom';end if;
 insert into public.audit_logs(actor_id,action,entity_id,details)values(actor,'promotion.created',p_request::text,jsonb_build_object('recipients',n,'occasion',p_occasion));
 return p_request;
end$$;

create function public.claim_promotions(p_campaign uuid default null,p_limit integer default 10)returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;begin
 with pick as(select d.id from public.promotion_deliveries d join public.promotion_campaigns c on c.id=d.campaign_id
 where(p_campaign is null or d.campaign_id=p_campaign)and d.attempts<3 and c.expires_at>now()and(d.first_attempt_at is null or d.first_attempt_at>now()-interval'23 hours')
 and(d.status='pending'or(d.status='failed'and d.next_attempt_at<=now())or(d.status='processing'and d.locked_at<now()-interval'5 minutes'))order by d.created_at,d.id for update of d skip locked limit least(20,greatest(1,p_limit))),
 claimed as(update public.promotion_deliveries d set status='processing',claim_token=gen_random_uuid(),locked_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where d.id in(select id from pick)returning d.id,d.claim_token)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]')into result from claimed;return result;
end$$;
create function public.promotion_delivery_data(p_id uuid,p_claim uuid)returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;begin
 select to_jsonb(d)||jsonb_build_object('subject',c.subject,'message',c.message,'image_url',c.image_url,'occasion',c.occasion,'kind',pc.kind,'value',pc.value,'starts_at',pc.starts_at,'expires_at',pc.expires_at,'token',no.token,
 'allowed',coalesce(p.marketing_consent and ns.status='subscribed'and ns.confirmed_at is not null and u.email_confirmed_at is not null and lower(u.email)=lower(d.email)and pc.active and pc.expires_at>now()and pc.customer_id=d.user_id and no.token is not null,false))into result
 from public.promotion_deliveries d join public.promotion_campaigns c on c.id=d.campaign_id join public.profiles p on p.id=d.user_id join auth.users u on u.id=d.user_id
 left join public.newsletter_subscribers ns on ns.user_id=d.user_id left join public.newsletter_optouts no on no.subscriber_id=ns.id left join public.promo_codes pc on pc.id=d.promo_id
 where d.id=p_id and d.claim_token=p_claim and d.status='processing';return result;
end$$;
create function public.finish_promotion_delivery(p_id uuid,p_claim uuid,p_status text,p_error text default null,p_provider text default null)returns void language plpgsql security definer set search_path=public as $$begin
 if p_status not in('sent','failed','skipped')then raise exception 'Neispravan status isporuke';end if;
 update public.promotion_deliveries set status=p_status,sent_at=case when p_status='sent'then now()else sent_at end,provider_id=left(p_provider,150),next_attempt_at=case when p_status='failed'then now()+interval'1 minute'else next_attempt_at end,last_error=left(p_error,300),claim_token=null where id=p_id and claim_token=p_claim and status='processing';
end$$;
create function public.personal_promotion_summary()returns jsonb language plpgsql security definer set search_path=public as $$begin
 perform public.assert_admin();return(select coalesce(jsonb_agg(to_jsonb(r)),'[]')from(select c.*,(select count(*)from public.promotion_deliveries d where d.campaign_id=c.id)as recipients,
 (select count(*)from public.promotion_deliveries d where d.campaign_id=c.id and d.status='sent')as sent,
 (select count(*)from public.promotion_deliveries d where d.campaign_id=c.id and d.status in('pending','processing'))as pending,
 (select count(*)from public.promotion_deliveries d where d.campaign_id=c.id and d.status='failed')as failed,
 (select count(*)from public.promotion_deliveries d where d.campaign_id=c.id and d.status='skipped')as skipped
 from public.promotion_campaigns c order by c.created_at desc limit 50)r);end$$;
-- Budući kodovi ne smiju popustiti košaricu niti se iskoristiti kroz stari tok ponuda.
create function public.promo_date_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from public.promo_codes p where p.id=new.promo_id and p.active and p.starts_at<=now()and p.expires_at>now())then raise exception 'Kod još nije aktivan ili je istekao';end if;return new;end$$;
create trigger promo_date_guard before insert on public.promo_code_uses for each row execute function public.promo_date_guard();
alter function public.cart_pricing(text)rename to cart_pricing_before_dates;
create function public.cart_pricing(p_promo text default null)returns jsonb language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from public.promo_codes where code=upper(trim(p_promo))and starts_at>now())then raise exception 'Kod još nije aktivan';end if;
 return public.cart_pricing_before_dates(p_promo);end$$;
create or replace function public.discount_banner()returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('name',coalesce(name,'Posebna ponuda'),'code',code,'kind',kind,'value',value,'expires_at',expires_at,'first_order_only',first_order_only)
 from public.promo_codes where banner and active and starts_at<=now()and expires_at>now()
 and(select count(*)from public.promo_code_uses u where u.promo_id=promo_codes.id)<max_uses
 and not exists(select 1 from public.promo_code_uses u where u.promo_id=promo_codes.id and u.user_id=auth.uid())
 and(customer_id is null or customer_id=auth.uid())
 and(not first_order_only or auth.uid()is null or not exists(select 1 from public.orders o where o.user_id=auth.uid()))limit 1$$;
revoke all on function public.create_personal_promotion(uuid,text,text,text,integer,text,text,text,uuid[],timestamptz,timestamptz),public.claim_promotions(uuid,integer),public.promotion_delivery_data(uuid,uuid),public.finish_promotion_delivery(uuid,uuid,text,text,text),public.personal_promotion_summary(),public.promo_date_guard(),public.cart_pricing_before_dates(text),public.cart_pricing(text)from public,anon,authenticated;
grant execute on function public.create_personal_promotion(uuid,text,text,text,integer,text,text,text,uuid[],timestamptz,timestamptz),public.personal_promotion_summary(),public.cart_pricing(text)to authenticated;
grant execute on function public.claim_promotions(uuid,integer),public.promotion_delivery_data(uuid,uuid),public.finish_promotion_delivery(uuid,uuid,text,text,text)to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('promotion-images','promotion-images',true,2097152,array['image/png']);

-- Interni ključ za automatski worker: nije dostupan anon/korisničkom API-ju.
create table public.promotion_worker(id boolean primary key default true check(id),secret text not null);
alter table public.promotion_worker enable row level security;
revoke all on public.promotion_worker from public,anon,authenticated;
grant select on public.promotion_worker to service_role;
insert into public.promotion_worker(id,secret)values(true,replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''));
create function public.promotion_worker_authorized(p_secret text)returns boolean language sql security definer set search_path=public as $$select coalesce((select sha256(convert_to(secret,'UTF8'))=sha256(convert_to(p_secret,'UTF8'))from public.promotion_worker where id),false)$$;
create function public.promotion_worker_ready()returns boolean language plpgsql security definer set search_path=public as $$declare ready boolean:=false;begin
 if to_regclass('cron.job')is not null then execute 'select exists(select 1 from cron.job where jobname=''formapoint-personal-promotions''and active)'into ready;end if;return ready;
end$$;
revoke all on function public.promotion_worker_authorized(text),public.promotion_worker_ready()from public,anon,authenticated;
grant execute on function public.promotion_worker_authorized(text),public.promotion_worker_ready()to service_role;
-- Na Supabaseu postavlja se obrada svake minute. Minimalni lokalni PostgreSQL
-- adapter bez ovih ekstenzija i dalje podržava kreiranje i ručnu obradu.
do $worker_setup$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron')and exists(select 1 from pg_available_extensions where name='pg_net')then
  begin
   execute 'create extension if not exists pg_cron';execute 'create extension if not exists pg_net';
   execute $schedule$select cron.schedule('formapoint-personal-promotions','* * * * *',$job$
    select net.http_post(url:='https://heseilggogbtmqeuwlku.supabase.co/functions/v1/promotions',
     headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select secret from public.promotion_worker where id)),
     body:='{"action":"process"}'::jsonb,timeout_milliseconds:=60000);
   $job$);$schedule$;
  exception when others then raise notice 'Automatski worker nije zakazan. Omogućite pg_cron i pg_net te ponovite SQL iz uputa za promocije.';
  end;
 end if;
end$worker_setup$;
NOTIFY pgrst, 'reload schema';

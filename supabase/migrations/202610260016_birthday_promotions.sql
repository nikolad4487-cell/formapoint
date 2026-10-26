-- Rođendan čuva samo dan i mjesec, bez godine rođenja.
alter table public.profiles add column if not exists birthday_day smallint,add column if not exists birthday_month smallint;
do $$begin if not exists(select 1 from pg_constraint where conname='profiles_birthday_valid'and conrelid='public.profiles'::regclass)then
 alter table public.profiles add constraint profiles_birthday_valid check(
 (birthday_day is null and birthday_month is null)or
 (birthday_day is not null and birthday_month is not null and birthday_month between 1 and 12 and birthday_day between 1 and extract(day from(make_date(2000,birthday_month,1)+interval'1 month - 1 day'))));
end if;end$$;
grant update(birthday_day,birthday_month)on public.profiles to authenticated;

create table if not exists public.birthday_promotion_settings(
 id boolean primary key default true check(id),active boolean not null default false,
 name text not null,kind text not null check(kind in('percent','fixed')),value integer not null check(value between 1 and 100000000 and(kind<>'percent'or value<=100)),
 validity_days integer not null default 30 check(validity_days between 1 and 365),
 subject text not null,message text not null,image_url text not null,created_by uuid not null references auth.users,updated_at timestamptz not null default now()
);
-- Godišnja evidencija ostaje i kada se kupon ili dnevna kampanja obrišu.
create table if not exists public.birthday_promotion_issues(
 user_id uuid not null references auth.users on delete cascade,birthday_year integer not null,birthday_date date not null,
 campaign_id uuid references public.promotion_campaigns on delete set null,promo_id uuid references public.promo_codes on delete set null,
 primary key(user_id,birthday_year)
);
alter table public.birthday_promotion_settings enable row level security;
alter table public.birthday_promotion_issues enable row level security;
revoke all on public.birthday_promotion_settings,public.birthday_promotion_issues from public,anon,authenticated;
grant select on public.birthday_promotion_settings to authenticated;
grant all on public.birthday_promotion_settings,public.birthday_promotion_issues to service_role;
drop policy if exists admin_read on public.birthday_promotion_settings;
create policy admin_read on public.birthday_promotion_settings for select to authenticated using(public.is_admin());

create or replace function public.birthday_in_year(p_day integer,p_month integer,p_year integer)returns date
language sql immutable strict set search_path=public as $$
 select make_date(p_year,p_month,least(p_day,extract(day from(make_date(p_year,p_month,1)+interval'1 month - 1 day'))::integer))
$$;
revoke all on function public.birthday_in_year(integer,integer,integer)from public,anon,authenticated;
grant execute on function public.birthday_in_year(integer,integer,integer)to service_role;

create or replace function public.save_birthday_promotion(p_name text,p_kind text,p_value integer,p_subject text,p_message text,p_image_url text,p_days integer default 30,p_active boolean default true)returns void
language plpgsql security definer set search_path=public as $$declare actor uuid:=public.assert_user();begin
 perform public.assert_admin();
 if p_name is null or length(trim(p_name))not between 2 and 150 or p_kind is null or p_kind not in('percent','fixed')or p_value is null or p_value not between 1 and 100000000 or(p_kind='percent'and p_value>100)or p_subject is null or length(trim(p_subject))not between 2 and 150 or p_message is null or length(trim(p_message))not between 10 and 5000 or p_days is null or p_days not between 1 and 365 or p_active is null then raise exception 'Provjerite naziv, poruku, popust i broj dana valjanosti';end if;
 if p_image_url is null or length(p_image_url)>2000 or p_image_url!~'^https://[^[:space:]]+$'then raise exception 'Odaberite sliku promocije';end if;
 perform pg_advisory_xact_lock(hashtextextended('birthday-promotions',0));
 insert into public.birthday_promotion_settings(id,active,name,kind,value,subject,message,image_url,validity_days,created_by)
 values(true,p_active,trim(p_name),p_kind,p_value,trim(p_subject),trim(p_message),p_image_url,p_days,actor)
 on conflict(id)do update set active=excluded.active,name=excluded.name,kind=excluded.kind,value=excluded.value,subject=excluded.subject,message=excluded.message,image_url=excluded.image_url,validity_days=excluded.validity_days,created_by=actor,updated_at=now();
 insert into public.audit_logs(actor_id,action,entity_id,details)values(actor,'birthday_promotion.saved','birthday',jsonb_build_object('active',p_active,'validity_days',p_days));
end$$;
revoke all on function public.save_birthday_promotion(text,text,integer,text,text,text,integer,boolean)from public,anon;
grant execute on function public.save_birthday_promotion(text,text,integer,text,text,text,integer,boolean)to authenticated;

create or replace function public.enqueue_birthday_promotions()returns integer
language plpgsql security definer set search_path=public as $$
declare settings public.birthday_promotion_settings;today date:=(now()at time zone'Europe/Zagreb')::date;yr integer:=extract(year from today);r record;campaign uuid;coupon uuid;v_code text;v_start timestamptz;v_end timestamptz;n integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('birthday-promotions',0));
 select * into settings from public.birthday_promotion_settings where id and active;
 if not found then return 0;end if;
 v_start:=today::timestamp at time zone'Europe/Zagreb';v_end:=(today+settings.validity_days)::timestamp at time zone'Europe/Zagreb';
 for r in select p.id,p.first_name,u.email from public.profiles p join auth.users u on u.id=p.id join public.newsletter_subscribers ns on ns.user_id=p.id
 where p.birthday_day is not null and public.birthday_in_year(p.birthday_day,p.birthday_month,yr)=today
 and p.marketing_consent and ns.status='subscribed'and ns.confirmed_at is not null and u.email_confirmed_at is not null and not u.is_anonymous
 and nullif(u.email,'')is not null and lower(ns.email)=lower(u.email)and exists(select 1 from public.newsletter_optouts o where o.subscriber_id=ns.id)
 and not exists(select 1 from public.birthday_promotion_issues i where i.user_id=p.id and i.birthday_year=yr)
 order by p.id limit 1000 loop
  if campaign is null then
   campaign:=gen_random_uuid();
   insert into public.promotion_campaigns(id,name,occasion,kind,value,subject,message,image_url,starts_at,expires_at,request_hash,created_by)
   values(campaign,settings.name||' · '||to_char(today,'DD.MM.YYYY'),'birthday',settings.kind,settings.value,settings.subject,settings.message,settings.image_url,v_start,v_end,'birthday:'||today::text,settings.created_by);
  end if;
  v_code:='RODJENDAN-'||upper(left(replace(gen_random_uuid()::text,'-',''),20));
  insert into public.promo_codes(name,code,kind,value,max_uses,starts_at,expires_at,customer_id)values(settings.name,v_code,settings.kind,settings.value,1,v_start,v_end,r.id)returning id into coupon;
  insert into public.promotion_deliveries(campaign_id,user_id,promo_id,code,recipient_name,email)values(campaign,r.id,coupon,v_code,coalesce(nullif(trim(r.first_name),''),'korisniče'),r.email);
  insert into public.birthday_promotion_issues(user_id,birthday_year,birthday_date,campaign_id,promo_id)values(r.id,yr,today,campaign,coupon);
  n:=n+1;
 end loop;
 return n;
end$$;
revoke all on function public.enqueue_birthday_promotions()from public,anon,authenticated;
grant execute on function public.enqueue_birthday_promotions()to service_role;

-- Završna provjera vrijedi i za već rezervirane rođendanske poruke.
do $$begin if to_regprocedure('public.promotion_delivery_data_015(uuid,uuid)')is null then
 alter function public.promotion_delivery_data(uuid,uuid)rename to promotion_delivery_data_015;
end if;end$$;
revoke all on function public.promotion_delivery_data_015(uuid,uuid)from public,anon,authenticated;
grant execute on function public.promotion_delivery_data_015(uuid,uuid)to service_role;
create or replace function public.promotion_delivery_data(p_id uuid,p_claim uuid)returns jsonb
language plpgsql security definer set search_path=public as $$declare result jsonb;begin
 result:=public.promotion_delivery_data_015(p_id,p_claim);
 if result is not null and exists(select 1 from public.birthday_promotion_issues i where i.promo_id=(result->>'promo_id')::uuid)and not exists(select 1 from public.birthday_promotion_settings s join public.birthday_promotion_issues i on i.promo_id=(result->>'promo_id')::uuid join public.profiles p on p.id=i.user_id where s.id and s.active and public.birthday_in_year(p.birthday_day,p.birthday_month,i.birthday_year)=i.birthday_date)then
  result:=jsonb_set(result,'{allowed}','false'::jsonb);
 end if;
 return result;
end$$;
revoke all on function public.promotion_delivery_data(uuid,uuid)from public,anon,authenticated;
grant execute on function public.promotion_delivery_data(uuid,uuid)to service_role;
NOTIFY pgrst, 'reload schema';

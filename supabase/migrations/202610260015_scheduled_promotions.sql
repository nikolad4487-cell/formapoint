-- Slanje počinje tek kada je promocija i pripadajući kod važeći.
create or replace function public.claim_promotions(p_campaign uuid default null,p_limit integer default 10)returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;begin
 with pick as(select d.id from public.promotion_deliveries d join public.promotion_campaigns c on c.id=d.campaign_id
 where(p_campaign is null or d.campaign_id=p_campaign)and d.attempts<3 and c.starts_at<=now()and c.expires_at>now()and not exists(select 1 from public.promo_codes pc where pc.id=d.promo_id and pc.starts_at>now())and(d.first_attempt_at is null or d.first_attempt_at>now()-interval'23 hours')
 and(d.status='pending'or(d.status='failed'and d.next_attempt_at<=now())or(d.status='processing'and d.locked_at<now()-interval'5 minutes'))order by d.created_at,d.id for update of d skip locked limit least(20,greatest(1,p_limit))),
 claimed as(update public.promotion_deliveries d set status='processing',claim_token=gen_random_uuid(),locked_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where d.id in(select id from pick)returning d.id,d.claim_token)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]')into result from claimed;return result;
end$$;
create or replace function public.promotion_delivery_data(p_id uuid,p_claim uuid)returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;begin
 select to_jsonb(d)||jsonb_build_object('subject',c.subject,'message',c.message,'image_url',c.image_url,'occasion',c.occasion,'kind',pc.kind,'value',pc.value,'send_at',greatest(c.starts_at,pc.starts_at),'starts_at',pc.starts_at,'expires_at',pc.expires_at,'token',no.token,
 'allowed',coalesce(p.marketing_consent and ns.status='subscribed'and ns.confirmed_at is not null and u.email_confirmed_at is not null and lower(u.email)=lower(d.email)and c.starts_at<=now()and c.expires_at>now()and pc.starts_at<=now()and pc.active and pc.expires_at>now()and pc.customer_id=d.user_id and no.token is not null,false))into result
 from public.promotion_deliveries d join public.promotion_campaigns c on c.id=d.campaign_id join public.profiles p on p.id=d.user_id join auth.users u on u.id=d.user_id
 left join public.newsletter_subscribers ns on ns.user_id=d.user_id left join public.newsletter_optouts no on no.subscriber_id=ns.id left join public.promo_codes pc on pc.id=d.promo_id
 where d.id=p_id and d.claim_token=p_claim and d.status='processing';return result;
end$$;

create or replace function public.create_personal_promotion(p_request uuid,p_name text,p_occasion text,p_kind text,p_value integer,p_subject text,p_message text,p_image_url text,p_users uuid[] default null,p_starts timestamptz default null,p_expires timestamptz default null)returns uuid
language plpgsql security definer set search_path=public as $$
declare actor uuid:=public.assert_user();v_start timestamptz:=coalesce(p_starts,now());v_end timestamptz:=coalesce(p_expires,v_start+interval'30 days');fingerprint text;old_hash text;r record;coupon uuid;v_code text;n integer:=0;
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


NOTIFY pgrst, 'reload schema';
create or replace function public.promotion_schedule_ready()returns boolean language sql stable set search_path=public as $$select true$$;
revoke all on function public.promotion_schedule_ready()from public,anon,authenticated;
grant execute on function public.promotion_schedule_ready()to service_role;
NOTIFY pgrst, 'reload schema';

-- Neobvezna javna pozivna poveznica. Prazno polje skriva gumb.
alter table public.site_settings add column if not exists whatsapp_community_url text;
do $$begin if not exists(select 1 from pg_constraint where conrelid='public.site_settings'::regclass and conname='site_settings_whatsapp_https')then
 alter table public.site_settings add constraint site_settings_whatsapp_https check(whatsapp_community_url is null or whatsapp_community_url='' or(length(whatsapp_community_url)<=2000 and whatsapp_community_url~'^https://[^[:space:]]+$'));
end if;end$$;
NOTIFY pgrst,'reload schema';

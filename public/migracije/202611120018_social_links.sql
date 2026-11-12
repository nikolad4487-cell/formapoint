-- FormaPoint: Facebook, Instagram i WhatsApp zajednica. Nakon nadogradnje 006.
BEGIN;
DO $guard$BEGIN IF not exists(select 1 from information_schema.columns where table_schema='public'and table_name='site_settings'and column_name='facebook_url') THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 006.';END IF;END$guard$;
-- Neobvezna javna pozivna poveznica. Prazno polje skriva gumb.
alter table public.site_settings add column if not exists whatsapp_community_url text;
do $$begin if not exists(select 1 from pg_constraint where conrelid='public.site_settings'::regclass and conname='site_settings_whatsapp_https')then
 alter table public.site_settings add constraint site_settings_whatsapp_https check(whatsapp_community_url is null or whatsapp_community_url='' or(length(whatsapp_community_url)<=2000 and whatsapp_community_url~'^https://[^[:space:]]+$'));
end if;end$$;
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202611120018','social_links',ARRAY[$source$-- Neobvezna javna pozivna poveznica. Prazno polje skriva gumb.
alter table public.site_settings add column if not exists whatsapp_community_url text;
do $$begin if not exists(select 1 from pg_constraint where conrelid='public.site_settings'::regclass and conname='site_settings_whatsapp_https')then
 alter table public.site_settings add constraint site_settings_whatsapp_https check(whatsapp_community_url is null or whatsapp_community_url='' or(length(whatsapp_community_url)<=2000 and whatsapp_community_url~'^https://[^[:space:]]+$'));
end if;end$$;
NOTIFY pgrst,'reload schema';
$source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Poveznica WhatsApp zajednice može se spremiti u Opće postavke.'AS rezultat;

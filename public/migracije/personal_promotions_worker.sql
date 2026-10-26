-- Samo ako modul promocija prikazuje da pozadinska obrada nije uključena.
-- Preduvjet: već primijenjena SQL nadogradnja 014. Ne unosi se tajni ključ ručno.
BEGIN;
DO $guard$BEGIN IF to_regclass('public.promotion_worker')IS NULL THEN RAISE EXCEPTION 'Prvo primijenite nadogradnju 014.';END IF;END$guard$;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.schedule('formapoint-personal-promotions','* * * * *',$job$
 SELECT net.http_post(
  url:='https://heseilggogbtmqeuwlku.supabase.co/functions/v1/promotions',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT secret FROM public.promotion_worker WHERE id)),
  body:='{"action":"process"}'::jsonb,timeout_milliseconds:=60000);
$job$);
COMMIT;
SELECT jobname,active,schedule FROM cron.job WHERE jobname='formapoint-personal-promotions';

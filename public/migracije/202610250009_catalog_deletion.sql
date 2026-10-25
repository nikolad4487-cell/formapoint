-- FormaPoint: brisanje svih artikala (početnih i naknadno dodanih).
-- Pokrenite cijelu datoteku jednom u Supabase SQL Editoru. Potrebne su osnovne migracije 001–005.
-- Ova nadogradnja samo dodaje mogućnost brisanja; sama ne briše artikle.
BEGIN;
DO $fp_guard$BEGIN
 IF to_regprocedure('public.sync_service_category()') IS NULL THEN RAISE EXCEPTION 'Prvo primijenite osnovne migracije 001–005.'; END IF;
 IF to_regprocedure('public.admin_delete_service(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Nadogradnja 009 već je primijenjena.'; END IF;
END $fp_guard$;
-- Brisanje artikla zadržava snimke stavki i iznose postojećih narudžbi.
create function public.admin_delete_service(p_service uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_admin();
  perform 1 from public.services where id=p_service for update;
  if not found then raise exception 'Artikl nije pronađen. Osvježite katalog.'; end if;
  delete from public.cart_items where service_id=p_service;
  delete from public.service_variants where service_id=p_service;
  delete from public.service_options where service_id=p_service;
  update public.order_items set service_id=null where service_id=p_service;
  update public.service_price_history set service_id=null where service_id=p_service;
  -- Kupon za izbrisani artikl ne smije postati aktivan za cijeli katalog.
  update public.promo_codes set active=false, service_id=null where service_id=p_service;
  delete from public.services where id=p_service;
end $$;
create function public.admin_delete_category(p_category uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_admin();
  perform 1 from public.service_categories where id=p_category for update;
  if not found then raise exception 'Kategorija nije pronađena. Osvježite katalog.'; end if;
  if exists(select 1 from public.services where category_id=p_category) then
    raise exception 'Najprije izbrišite artikle iz ove kategorije ili ih premjestite u drugu kategoriju.';
  end if;
  delete from public.service_categories where id=p_category;
end $$;
revoke all on function public.admin_delete_service(uuid),public.admin_delete_category(uuid) from public,anon;
grant execute on function public.admin_delete_service(uuid),public.admin_delete_category(uuid) to authenticated;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements)VALUES('202610250009','catalog_deletion',ARRAY[$fp_source$-- Brisanje artikla zadržava snimke stavki i iznose postojećih narudžbi.
create function public.admin_delete_service(p_service uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_admin();
  perform 1 from public.services where id=p_service for update;
  if not found then raise exception 'Artikl nije pronađen. Osvježite katalog.'; end if;
  delete from public.cart_items where service_id=p_service;
  delete from public.service_variants where service_id=p_service;
  delete from public.service_options where service_id=p_service;
  update public.order_items set service_id=null where service_id=p_service;
  update public.service_price_history set service_id=null where service_id=p_service;
  -- Kupon za izbrisani artikl ne smije postati aktivan za cijeli katalog.
  update public.promo_codes set active=false, service_id=null where service_id=p_service;
  delete from public.services where id=p_service;
end $$;
create function public.admin_delete_category(p_category uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_admin();
  perform 1 from public.service_categories where id=p_category for update;
  if not found then raise exception 'Kategorija nije pronađena. Osvježite katalog.'; end if;
  if exists(select 1 from public.services where category_id=p_category) then
    raise exception 'Najprije izbrišite artikle iz ove kategorije ili ih premjestite u drugu kategoriju.';
  end if;
  delete from public.service_categories where id=p_category;
end $$;
revoke all on function public.admin_delete_service(uuid),public.admin_delete_category(uuid) from public,anon;
grant execute on function public.admin_delete_service(uuid),public.admin_delete_category(uuid) to authenticated;
$fp_source$])ON CONFLICT(version)DO NOTHING;
COMMIT;
SELECT 'Brisanje artikala i praznih kategorija omogućeno.' AS rezultat;

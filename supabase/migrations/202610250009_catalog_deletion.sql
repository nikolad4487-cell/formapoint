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

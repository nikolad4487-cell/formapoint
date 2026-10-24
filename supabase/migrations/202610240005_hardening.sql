alter table public.profiles add constraint profile_name_lengths check(length(first_name)<=150 and length(last_name)<=150 and length(coalesce(phone,''))<=40);
-- Kartični checkout je prvi aktivni adapter. Bankovne potvrde i refundacije traže zaseban auditirani postupak.
create function public.mark_file_scanned(p_file uuid,p_status text,p_reason text)returns void language plpgsql security definer set search_path=public as $$begin perform public.assert_admin();if p_status not in('clean','rejected')or length(trim(p_reason))<10 then raise exception 'Potrebna je obrazložena sigurnosna provjera';end if;update public.order_files set scan_status=p_status where id=p_file;if not found then raise exception 'Datoteka nije pronađena';end if;insert into public.audit_logs(actor_id,action,entity_id,details)values(auth.uid(),'file.security_review',p_file::text,jsonb_build_object('result',p_status,'reason',left(p_reason,500)));end$$;
revoke all on function public.mark_file_scanned(uuid,text,text)from public,anon;
grant execute on function public.mark_file_scanned(uuid,text,text)to authenticated,service_role;
-- Usklađenje kategorizacije pri uređivanju usluge i naziva kategorije.
create function public.sync_service_category()returns trigger language plpgsql security definer set search_path=public as $$begin select id into new.category_id from public.service_categories where name=new.category;if new.category_id is null then raise exception 'Odaberite postojeću kategoriju';end if;return new;end$$;
create trigger sync_service_category before insert or update of category on public.services for each row execute function public.sync_service_category();
create function public.sync_category_name()returns trigger language plpgsql security definer set search_path=public as $$begin update public.services set category=new.name where category_id=new.id;return new;end$$;
create trigger sync_category_name after update of name on public.service_categories for each row execute function public.sync_category_name();
revoke all on function public.sync_service_category(),public.sync_category_name()from public,anon,authenticated;
-- Realtime poštuje RLS; interne bilješke ne izlaze korisniku.
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime')then alter publication supabase_realtime add table public.order_messages;end if;end$$;

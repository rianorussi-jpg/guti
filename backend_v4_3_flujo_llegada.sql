begin;
alter table public.orders add column if not exists courier_arrived_at timestamptz;
create or replace function public.courier_mark_arrived_v43(p_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;
begin
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pedido no encontrado.'; end if;
 if o.courier_id is distinct from auth.uid() then raise exception 'Este pedido no está asignado a tu cuenta.'; end if;
 if o.status::text <> 'on_the_way' then raise exception 'Primero inicia la entrega.'; end if;
 if o.courier_arrived_at is null then update public.orders set courier_arrived_at=now() where id=p_order_id; end if;
end $$;
grant execute on function public.courier_mark_arrived_v43(uuid) to authenticated;
commit;

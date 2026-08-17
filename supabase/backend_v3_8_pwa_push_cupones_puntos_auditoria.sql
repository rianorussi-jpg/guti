-- ============================================================
-- GUTI.MX v3.8
-- PWA + PUSH + CUPONES + PUNTOS + REFERIDOS + AUDITORIA + CIERRE
-- Ejecutar DESPUÉS de v3.7.
-- ============================================================
begin;

-- ============================================================
-- 1) PUSH WEB REAL
-- ============================================================
alter table public.notifications
  add column if not exists push_sent_at timestamptz;

create table if not exists public.push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  app text not null default 'cliente',
  user_agent text,
  is_active boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "users manage own push" on public.push_subscriptions;
create policy "users manage own push" on public.push_subscriptions for all to authenticated
using(user_id=auth.uid() or public.is_guti_admin())
with check(user_id=auth.uid() or public.is_guti_admin());


-- ============================================================
-- 1B) FAVORITOS SINCRONIZADOS
-- ============================================================
create table if not exists public.favorite_merchants(
  user_id uuid not null references public.profiles(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,merchant_id)
);
alter table public.favorite_merchants enable row level security;
drop policy if exists "users manage favorite merchants" on public.favorite_merchants;
create policy "users manage favorite merchants"
on public.favorite_merchants for all to authenticated
using(user_id=auth.uid() or public.is_guti_admin())
with check(user_id=auth.uid() or public.is_guti_admin());

-- ============================================================
-- 2) CUPONES
-- ============================================================
create table if not exists public.coupons(
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  discount_type text not null check(discount_type in ('fixed','percent','free_delivery')),
  discount_value numeric(12,2) not null default 0,
  max_discount numeric(12,2),
  min_subtotal numeric(12,2) not null default 0,
  merchant_id uuid references public.merchants(id) on delete cascade,
  first_order_only boolean not null default false,
  max_uses integer,
  per_user_limit integer not null default 1,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.coupon_uses(
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  discount_amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  unique(coupon_id,order_id)
);
alter table public.coupons enable row level security;
alter table public.coupon_uses enable row level security;
drop policy if exists "customers read active coupons" on public.coupons;
create policy "customers read active coupons" on public.coupons for select to authenticated
using(is_active=true or public.is_guti_admin());
drop policy if exists "admin manage coupons" on public.coupons;
create policy "admin manage coupons" on public.coupons for all to authenticated
using(public.is_guti_admin()) with check(public.is_guti_admin());
drop policy if exists "users see own coupon uses" on public.coupon_uses;
create policy "users see own coupon uses" on public.coupon_uses for select to authenticated
using(user_id=auth.uid() or public.is_guti_admin());

alter table public.orders
  add column if not exists coupon_code text,
  add column if not exists coupon_discount numeric(12,2) not null default 0,
  add column if not exists points_used integer not null default 0,
  add column if not exists points_discount numeric(12,2) not null default 0;

-- Calcula una cotización sin modificar saldo.
create or replace function public.quote_checkout_v38(
  p_merchant_id uuid,
  p_subtotal numeric,
  p_coupon_code text default null,
  p_points_requested integer default 0,
  p_user_id uuid default null
)
returns table(
  coupon_discount numeric,
  points_used integer,
  points_discount numeric,
  delivery_fee numeric,
  total numeric,
  coupon_message text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.coupons%rowtype;
  uid uuid:=coalesce(p_user_id,auth.uid());
  points_balance integer:=0;
  cd numeric:=0;
  pd numeric:=0;
  pu integer:=0;
  fee numeric:=45;
  uses_count integer:=0;
  user_uses integer:=0;
  prior_orders integer:=0;
  msg text:='';
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select coalesce(points,0) into points_balance from public.profiles where id=uid;

  if nullif(upper(trim(coalesce(p_coupon_code,''))),'') is not null then
    select * into c from public.coupons where code=upper(trim(p_coupon_code)) limit 1;
    if not found then msg:='Cupón no encontrado';
    elsif not c.is_active then msg:='Cupón inactivo';
    elsif c.starts_at is not null and now()<c.starts_at then msg:='Este cupón todavía no inicia';
    elsif c.ends_at is not null and now()>=c.ends_at then msg:='Este cupón ya venció';
    elsif c.merchant_id is not null and c.merchant_id<>p_merchant_id then msg:='Este cupón no aplica en este negocio';
    elsif p_subtotal<c.min_subtotal then msg:='Compra mínima $'||c.min_subtotal::text;
    else
      select count(*) into uses_count from public.coupon_uses where coupon_id=c.id;
      select count(*) into user_uses from public.coupon_uses where coupon_id=c.id and user_id=uid;
      select count(*) into prior_orders from public.orders where customer_id=uid and status='delivered';
      if c.max_uses is not null and uses_count>=c.max_uses then msg:='Cupón agotado';
      elsif user_uses>=c.per_user_limit then msg:='Ya utilizaste este cupón';
      elsif c.first_order_only and prior_orders>0 then msg:='Cupón exclusivo para primer pedido';
      else
        cd:=case c.discount_type
          when 'fixed' then least(p_subtotal,c.discount_value)
          when 'percent' then least(p_subtotal,round(p_subtotal*c.discount_value/100,2))
          when 'free_delivery' then 0
          else 0 end;
        if c.max_discount is not null then cd:=least(cd,c.max_discount); end if;
        if c.discount_type='free_delivery' then fee:=0; end if;
        msg:='Cupón aplicado';
      end if;
    end if;
  end if;

  -- 100 puntos = $10. Máximo 25% del subtotal por pedido.
  pu:=greatest(0,least(coalesce(p_points_requested,0),points_balance));
  pd:=least(round(pu*0.10,2),round(p_subtotal*0.25,2));
  pu:=floor(pd/0.10)::integer;

  return query select cd,pu,pd,fee,greatest(0,round(p_subtotal+fee-cd-pd,2)),msg;
end;
$$;
grant execute on function public.quote_checkout_v38(uuid,numeric,text,integer,uuid) to authenticated;

-- Antes de crear pedido recalcula descuentos desde servidor.
create or replace function public.orders_apply_discounts_v38()
returns trigger language plpgsql security definer set search_path=public as $$
declare q record;
begin
  select * into q from public.quote_checkout_v38(
    new.merchant_id,new.subtotal,new.coupon_code,new.points_used,new.customer_id
  );
  new.coupon_discount:=coalesce(q.coupon_discount,0);
  new.points_used:=coalesce(q.points_used,0);
  new.points_discount:=coalesce(q.points_discount,0);
  new.delivery_fee:=coalesce(q.delivery_fee,45);
  new.discount:=new.coupon_discount+new.points_discount;
  new.total:=greatest(0,round(new.subtotal+new.delivery_fee-new.discount,2));
  return new;
end $$;
drop trigger if exists trg_orders_apply_discounts_v38 on public.orders;
create trigger trg_orders_apply_discounts_v38 before insert on public.orders
for each row execute function public.orders_apply_discounts_v38();

-- Después de crear pedido descuenta puntos y registra uso del cupón.
create or replace function public.orders_consume_rewards_v38()
returns trigger language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if new.points_used>0 then
    update public.profiles set points=greatest(0,points-new.points_used) where id=new.customer_id;
    insert into public.points_ledger(user_id,order_id,points,reason)
    values(new.customer_id,new.id,-new.points_used,'Puntos usados en pedido');
  end if;
  if new.coupon_discount>0 or new.delivery_fee=0 then
    select id into cid from public.coupons where code=upper(trim(new.coupon_code)) limit 1;
    if cid is not null then
      insert into public.coupon_uses(coupon_id,user_id,order_id,discount_amount)
      values(cid,new.customer_id,new.id,new.coupon_discount + case when new.delivery_fee=0 then 45 else 0 end)
      on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_orders_consume_rewards_v38 on public.orders;
create trigger trg_orders_consume_rewards_v38 after insert on public.orders
for each row execute function public.orders_consume_rewards_v38();

-- ============================================================
-- 3) REFERIDOS TERMINADOS
-- ============================================================
create or replace function public.apply_referral_code_v38(p_code text)
returns void language plpgsql security definer set search_path=public as $$
declare ref uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if exists(select 1 from public.referrals where referred_id=auth.uid())
    or exists(select 1 from public.profiles where id=auth.uid() and referred_by is not null)
  then raise exception 'Ya tienes un referido registrado'; end if;
  select id into ref from public.profiles where referral_code=upper(trim(p_code)) limit 1;
  if ref is null then raise exception 'Código no válido'; end if;
  if ref=auth.uid() then raise exception 'No puedes usar tu propio código'; end if;
  insert into public.referrals(referrer_id,referred_id) values(ref,auth.uid());
  update public.profiles set referred_by=ref where id=auth.uid();
end $$;
grant execute on function public.apply_referral_code_v38(text) to authenticated;

-- ============================================================
-- 4) AUDITORÍA ADMINISTRATIVA
-- ============================================================
create table if not exists public.audit_logs(
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
drop policy if exists "admin reads audit" on public.audit_logs;
create policy "admin reads audit" on public.audit_logs for select to authenticated using(public.is_guti_admin());

create or replace function public.audit_row_v38()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data)
  values(auth.uid(),tg_op,lower(tg_table_name),
    coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',''),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new,old);
end $$;

drop trigger if exists audit_orders_v38 on public.orders;
create trigger audit_orders_v38 after update on public.orders for each row execute function public.audit_row_v38();
drop trigger if exists audit_settlements_v38 on public.weekly_settlements;
create trigger audit_settlements_v38 after update on public.weekly_settlements for each row execute function public.audit_row_v38();
drop trigger if exists audit_cash_v38 on public.courier_cash_deposits;
create trigger audit_cash_v38 after update on public.courier_cash_deposits for each row execute function public.audit_row_v38();

-- ============================================================
-- 5) CIERRE OPERATIVO DIARIO
-- ============================================================
create or replace view public.daily_operations_v38
with (security_invoker=true) as
select
  ((coalesce(o.delivered_at,o.created_at) at time zone 'America/Mexico_City')::date) business_date,
  count(*) filter(where o.status='delivered')::integer delivered_orders,
  count(*) filter(where o.status='cancelled')::integer cancelled_orders,
  round(sum(o.total) filter(where o.status='delivered'),2) gmv,
  round(sum(o.guti_revenue) filter(where o.status='delivered'),2) guti_revenue,
  round(sum(o.merchant_net_amount) filter(where o.status='delivered'),2) merchant_net,
  round(sum(o.courier_payable) filter(where o.status='delivered'),2) courier_payable,
  round(sum(o.cash_collected_amount) filter(where o.status='delivered' and o.payment_method::text='cash'),2) cash_collected
from public.orders o
group by 1 order by 1 desc;

-- ============================================================
-- 6) CUPONES DE ARRANQUE DE EJEMPLO (inactivos)
-- ============================================================
insert into public.coupons(code,name,description,discount_type,discount_value,min_subtotal,is_active)
values
('GUTI50','$50 de descuento','Cupón general de ejemplo','fixed',50,250,false),
('ENVIOGRATIS','Envío gratis','Envío gratis de ejemplo','free_delivery',0,200,false)
on conflict(code) do nothing;


-- ============================================================
-- 7) PUSH EVENT-DRIVEN
-- Cada INSERT en notifications llama al dispatcher de Guti Admin.
-- Esto evita depender de un cron de Vercel cada minuto.
-- ============================================================
drop trigger if exists guti_push_dispatch_webhook_v38 on public.notifications;
create trigger guti_push_dispatch_webhook_v38
after insert on public.notifications
for each row
execute function supabase_functions.http_request(
  'https://gutiadmin.enla.mx/api/push/dispatch',
  'POST',
  '{"Content-Type":"application/json"}',
  '{}',
  '5000'
);

commit;

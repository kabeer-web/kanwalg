-- ============================================================
-- Restaurant POS & Ordering System — Full Supabase Schema
-- Run once in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- TABLES
-- ------------------------------------------------------------

create table if not exists restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  table_number text not null unique,
  qr_token uuid not null unique default gen_random_uuid(),
  status text not null default 'available'
    check (status in ('available','occupied','needs_bill')),
  created_at timestamptz default now()
);

create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  price numeric not null check (price >= 0),
  stock_qty numeric,              -- null = unlimited / not tracked
  is_available boolean not null default true,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_type text not null check (order_type in ('dine_in','delivery')),
  table_id uuid references restaurant_tables(id),
  customer_name text,
  customer_phone text,
  delivery_address text,
  status text not null default 'confirmed'
    check (status in ('pending_confirmation','confirmed','preparing','ready','completed','cancelled')),
  subtotal numeric not null default 0,
  total numeric not null default 0,
  notes text,
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id),
  item_name text not null,   -- snapshot, survives menu edits later
  price numeric not null,    -- snapshot
  qty int not null check (qty > 0),
  notes text
);

create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_table on orders(table_id);
create index if not exists idx_order_items_order on order_items(order_id);

-- ------------------------------------------------------------
-- RPC: place_order — atomic, callable by anonymous customers.
-- p_items example: [{"menu_item_id":"...", "qty":2, "notes":"no onions"}, ...]
-- ------------------------------------------------------------
create or replace function place_order(
  p_order_type text,
  p_table_qr_token uuid,          -- pass the table's QR token for dine_in, null for delivery
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_items jsonb
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_id uuid;
  v_order orders;
  v_item jsonb;
  v_menu_item menu_items;
  v_subtotal numeric := 0;
  v_status text;
begin
  if p_order_type = 'dine_in' then
    select id into v_table_id from restaurant_tables where qr_token = p_table_qr_token;
    if v_table_id is null then
      raise exception 'Invalid table QR code';
    end if;
    v_status := 'confirmed';       -- dine-in is trusted, goes straight to kitchen
  elsif p_order_type = 'delivery' then
    v_table_id := null;
    v_status := 'pending_confirmation';  -- staff must call & confirm first
  else
    raise exception 'order_type must be dine_in or delivery';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Order must have at least one item';
  end if;

  -- Validate stock and compute subtotal BEFORE inserting anything
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid;
    if v_menu_item is null or not v_menu_item.is_available then
      raise exception 'Item not available: %', v_item->>'menu_item_id';
    end if;
    if v_menu_item.stock_qty is not null and v_menu_item.stock_qty < (v_item->>'qty')::numeric then
      raise exception 'Not enough stock for %', v_menu_item.name;
    end if;
    v_subtotal := v_subtotal + (v_menu_item.price * (v_item->>'qty')::numeric);
  end loop;

  insert into orders (order_type, table_id, customer_name, customer_phone, delivery_address, status, subtotal, total, confirmed_at)
  values (p_order_type, v_table_id, p_customer_name, p_customer_phone, p_delivery_address, v_status, v_subtotal, v_subtotal,
          case when v_status = 'confirmed' then now() else null end)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid;
    insert into order_items (order_id, menu_item_id, item_name, price, qty, notes)
    values (v_order.id, v_menu_item.id, v_menu_item.name, v_menu_item.price, (v_item->>'qty')::int, v_item->>'notes');

    if v_menu_item.stock_qty is not null then
      update menu_items set stock_qty = stock_qty - (v_item->>'qty')::numeric where id = v_menu_item.id;
    end if;
  end loop;

  if v_table_id is not null then
    update restaurant_tables set status = 'occupied' where id = v_table_id;
  end if;

  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- RPC: confirm_order — staff confirms a pending delivery order
-- ------------------------------------------------------------
create or replace function confirm_order(p_order_id uuid)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare v_order orders;
begin
  update orders set status = 'confirmed', confirmed_at = now()
  where id = p_order_id and status = 'pending_confirmation'
  returning * into v_order;
  if v_order is null then raise exception 'Order not found or already confirmed'; end if;
  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- RPC: update_order_status — kitchen/counter status transitions
-- ------------------------------------------------------------
create or replace function update_order_status(p_order_id uuid, p_status text)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare v_order orders;
begin
  if p_status not in ('preparing','ready','completed','cancelled') then
    raise exception 'Invalid status transition: %', p_status;
  end if;
  update orders set
    status = p_status,
    ready_at = case when p_status = 'ready' then now() else ready_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_order_id
  returning * into v_order;

  if p_status in ('completed','cancelled') and v_order.table_id is not null then
    -- Free the table only if it has no other active orders
    if not exists (
      select 1 from orders
      where table_id = v_order.table_id and status not in ('completed','cancelled') and id <> v_order.id
    ) then
      update restaurant_tables set status = 'available' where id = v_order.table_id;
    end if;
  end if;

  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table restaurant_tables enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Public (anon) menu browsing — customers aren't logged in
create policy "public_read_categories" on menu_categories for select using (true);
create policy "public_read_menu_items" on menu_items for select using (true);
create policy "public_read_tables" on restaurant_tables for select using (true);

-- Staff (authenticated) — full management access
create policy "staff_manage_categories" on menu_categories for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff_manage_menu_items" on menu_items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staff_manage_tables" on restaurant_tables for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Orders/order_items: NO direct anon access (contains phone numbers/addresses).
-- Customers can only create orders via the place_order() RPC (security definer).
-- Staff (authenticated) can read/update everything.
create policy "staff_read_orders" on orders for select using (auth.role() = 'authenticated');
create policy "staff_update_orders" on orders for update using (auth.role() = 'authenticated');
create policy "staff_read_order_items" on order_items for select using (auth.role() = 'authenticated');

grant execute on function place_order to anon, authenticated;
grant execute on function confirm_order to authenticated;
grant execute on function update_order_status to authenticated;

-- ------------------------------------------------------------
-- REALTIME
-- ------------------------------------------------------------
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table restaurant_tables;
alter publication supabase_realtime add table menu_items;

-- ------------------------------------------------------------
-- SEED DATA (edit/remove as needed)
-- ------------------------------------------------------------
insert into restaurant_tables (table_number) values ('1'),('2'),('3'),('4'),('5') on conflict do nothing;

insert into menu_categories (name, sort_order) values
  ('Starters', 1), ('Main Course', 2), ('Beverages', 3), ('Desserts', 4)
on conflict do nothing;

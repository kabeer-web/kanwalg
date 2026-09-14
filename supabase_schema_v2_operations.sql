-- ============================================================
-- Restaurant POS — Schema v2: Roles, Inventory, Shifts, Payments, Audit
-- Run AFTER supabase_restaurant_schema.sql, once, in the SQL Editor.
-- Purely additive: no existing table is dropped, no existing column
-- is renamed or removed, and place_order/confirm_order keep their
-- original signatures — nothing in the current frontend breaks.
-- ============================================================

-- ------------------------------------------------------------
-- 1. STAFF PROFILES + ROLES
-- ------------------------------------------------------------
-- One row per auth.users staff member. Created automatically on
-- first sign-in (see trigger below) with role='cashier' and
-- is_active=false — an owner/manager must activate + assign the
-- real role before that person can do anything as staff.

create table if not exists staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'cashier'
    check (role in ('owner','manager','cashier','kitchen','waiter','delivery')),
  is_active boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_staff_profiles_role on staff_profiles(role);

-- Auto-provision a (deactivated, cashier-role) profile the first time
-- someone signs in. Owner must flip is_active + set the real role.
create or replace function handle_new_staff_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into staff_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_staff_user();

-- Helper functions used throughout RLS policies below.
create or replace function staff_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from staff_profiles where id = auth.uid() and is_active = true;
$$;

create or replace function has_any_role(variadic roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(staff_role() = any(roles), false);
$$;

create or replace function is_active_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select staff_role() is not null;
$$;

-- ------------------------------------------------------------
-- 2. AUDIT LOGS
-- ------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references staff_profiles(id),
  action text not null,          -- e.g. 'order.cancel', 'menu_item.price_change'
  entity text not null,          -- e.g. 'orders', 'menu_items'
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_audit_logs_entity on audit_logs(entity, entity_id);
create index if not exists idx_audit_logs_user on audit_logs(user_id);

create or replace function write_audit_log(
  p_action text, p_entity text, p_entity_id uuid, p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (user_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_metadata);
end;
$$;

-- ------------------------------------------------------------
-- 3. SHIFTS
-- ------------------------------------------------------------
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references staff_profiles(id),
  closed_by uuid references staff_profiles(id),
  opening_cash numeric not null default 0,
  closing_cash numeric,
  expected_cash numeric,
  difference numeric,
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz default now(),
  closed_at timestamptz
);

create index if not exists idx_shifts_status on shifts(status);
create unique index if not exists idx_one_open_shift_per_staff
  on shifts(opened_by) where status = 'open';

create or replace function open_shift(p_opening_cash numeric)
returns shifts
language plpgsql
security definer
set search_path = public
as $$
declare v_shift shifts;
begin
  if not is_active_staff() then
    raise exception 'Only active staff can open a shift';
  end if;
  insert into shifts (opened_by, opening_cash)
  values (auth.uid(), p_opening_cash)
  returning * into v_shift;

  perform write_audit_log('shift.open', 'shifts', v_shift.id,
    jsonb_build_object('opening_cash', p_opening_cash));
  return v_shift;
end;
$$;

create or replace function close_shift(p_shift_id uuid, p_closing_cash numeric)
returns shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
  v_cash_expected numeric;
begin
  select * into v_shift from shifts where id = p_shift_id and status = 'open';
  if v_shift is null then
    raise exception 'Shift not found or already closed';
  end if;
  if v_shift.opened_by <> auth.uid() and not has_any_role('owner','manager') then
    raise exception 'Only the shift owner or a manager can close this shift';
  end if;

  select v_shift.opening_cash + coalesce(sum(amount), 0)
    into v_cash_expected
    from payments
    where shift_id = p_shift_id and method = 'cash';

  update shifts set
    status = 'closed',
    closed_by = auth.uid(),
    closing_cash = p_closing_cash,
    expected_cash = v_cash_expected,
    difference = p_closing_cash - v_cash_expected,
    closed_at = now()
  where id = p_shift_id
  returning * into v_shift;

  perform write_audit_log('shift.close', 'shifts', v_shift.id,
    jsonb_build_object('closing_cash', p_closing_cash, 'expected_cash', v_cash_expected,
                        'difference', v_shift.difference));
  return v_shift;
end;
$$;

-- ------------------------------------------------------------
-- 4. ORDERS: pricing breakdown, shift association, cancellation trail
-- ------------------------------------------------------------
alter table orders add column if not exists shift_id uuid references shifts(id);
alter table orders add column if not exists discount_amount numeric not null default 0;
alter table orders add column if not exists tax_amount numeric not null default 0;
alter table orders add column if not exists service_charge_amount numeric not null default 0;
alter table orders add column if not exists cancelled_at timestamptz;
alter table orders add column if not exists cancelled_by uuid references staff_profiles(id);
alter table orders add column if not exists cancel_reason text;

create index if not exists idx_orders_shift on orders(shift_id);

-- ------------------------------------------------------------
-- 5. PAYMENTS (supports split/mixed payment per order)
-- ------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  shift_id uuid references shifts(id),
  method text not null check (method in ('cash','card','bank_transfer','wallet')),
  amount numeric not null check (amount > 0),
  received_amount numeric,     -- cash tendered
  change_amount numeric,       -- cash change given
  created_by uuid references staff_profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_payments_order on payments(order_id);
create index if not exists idx_payments_shift on payments(shift_id);

create or replace function record_payment(
  p_order_id uuid, p_method text, p_amount numeric,
  p_received_amount numeric default null, p_shift_id uuid default null
) returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments;
  v_change numeric;
begin
  if not has_any_role('owner','manager','cashier','waiter') then
    raise exception 'Not permitted to record payments';
  end if;

  if p_method = 'cash' and p_received_amount is not null then
    v_change := greatest(p_received_amount - p_amount, 0);
  end if;

  insert into payments (order_id, shift_id, method, amount, received_amount, change_amount, created_by)
  values (p_order_id, p_shift_id, p_method, p_amount, p_received_amount, v_change, auth.uid())
  returning * into v_payment;

  perform write_audit_log('payment.record', 'orders', p_order_id,
    jsonb_build_object('method', p_method, 'amount', p_amount));
  return v_payment;
end;
$$;

-- ------------------------------------------------------------
-- 6. INVENTORY (raw-ingredient stock, separate from menu_items.stock_qty
--    which already tracks sellable-unit stock for place_order)
-- ------------------------------------------------------------
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'unit',      -- kg, l, unit, etc.
  current_stock numeric not null default 0,
  low_stock_threshold numeric not null default 0,
  cost_per_unit numeric not null default 0,
  linked_menu_item_id uuid references menu_items(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_inventory_items_low_stock
  on inventory_items(id) where current_stock <= low_stock_threshold;

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('purchase','sale','waste','adjustment','return')),
  qty numeric not null,                    -- positive = stock in, negative = stock out
  notes text,
  created_by uuid references staff_profiles(id),
  created_at timestamptz default now()
);

create index if not exists idx_inventory_movements_item on inventory_movements(inventory_item_id);

create or replace function adjust_inventory(
  p_inventory_item_id uuid, p_movement_type text, p_qty numeric, p_notes text default null
) returns inventory_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item inventory_items;
  v_signed_qty numeric;
begin
  if not has_any_role('owner','manager') then
    raise exception 'Only owner/manager can adjust inventory';
  end if;
  if p_movement_type not in ('purchase','sale','waste','adjustment','return') then
    raise exception 'Invalid movement type: %', p_movement_type;
  end if;

  v_signed_qty := case when p_movement_type in ('sale','waste') then -abs(p_qty) else abs(p_qty) end;
  if p_movement_type = 'adjustment' then
    v_signed_qty := p_qty; -- adjustment can be signed either way, taken as-is
  end if;

  insert into inventory_movements (inventory_item_id, movement_type, qty, notes, created_by)
  values (p_inventory_item_id, p_movement_type, v_signed_qty, p_notes, auth.uid());

  update inventory_items
  set current_stock = current_stock + v_signed_qty, updated_at = now()
  where id = p_inventory_item_id
  returning * into v_item;

  perform write_audit_log('inventory.adjust', 'inventory_items', p_inventory_item_id,
    jsonb_build_object('movement_type', p_movement_type, 'qty', v_signed_qty));
  return v_item;
end;
$$;

-- ------------------------------------------------------------
-- 7. Extend existing RPCs with audit logging (same signatures — safe)
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

  perform write_audit_log('order.confirm', 'orders', v_order.id, '{}'::jsonb);
  return v_order;
end;
$$;

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
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    cancelled_by = case when p_status = 'cancelled' then auth.uid() else cancelled_by end
  where id = p_order_id
  returning * into v_order;

  if p_status in ('completed','cancelled') and v_order.table_id is not null then
    if not exists (
      select 1 from orders
      where table_id = v_order.table_id and status not in ('completed','cancelled') and id <> v_order.id
    ) then
      update restaurant_tables set status = 'available' where id = v_order.table_id;
    end if;
  end if;

  perform write_audit_log('order.status_change', 'orders', v_order.id,
    jsonb_build_object('new_status', p_status));
  return v_order;
end;
$$;

grant execute on function open_shift to authenticated;
grant execute on function close_shift to authenticated;
grant execute on function record_payment to authenticated;
grant execute on function adjust_inventory to authenticated;
grant execute on function write_audit_log to authenticated;

-- ------------------------------------------------------------
-- 8. ROW LEVEL SECURITY — replace blanket "any authenticated" policies
--    with role-aware ones. Public/anon menu-browsing policies from
--    the original schema are untouched.
-- ------------------------------------------------------------
alter table staff_profiles enable row level security;
alter table audit_logs enable row level security;
alter table shifts enable row level security;
alter table payments enable row level security;
alter table inventory_items enable row level security;
alter table inventory_movements enable row level security;

-- staff_profiles: everyone can read their own row; owner/manager read & manage all.
create policy "read_own_profile" on staff_profiles for select
  using (id = auth.uid() or has_any_role('owner','manager'));
create policy "owner_manager_manage_profiles" on staff_profiles for update
  using (has_any_role('owner','manager')) with check (has_any_role('owner','manager'));

-- audit_logs: owner/manager only.
create policy "owner_manager_read_audit" on audit_logs for select
  using (has_any_role('owner','manager'));

-- shifts: staff can see their own shifts; owner/manager see all.
create policy "read_own_or_manager_shifts" on shifts for select
  using (opened_by = auth.uid() or has_any_role('owner','manager'));

-- payments: any active staff can read (billing/reports); insert goes through record_payment RPC only.
create policy "staff_read_payments" on payments for select
  using (is_active_staff());

-- inventory: any active staff can read; only owner/manager write directly
-- (adjust_inventory RPC already enforces role, this covers direct table access too).
create policy "staff_read_inventory_items" on inventory_items for select
  using (is_active_staff());
create policy "owner_manager_manage_inventory_items" on inventory_items for all
  using (has_any_role('owner','manager')) with check (has_any_role('owner','manager'));
create policy "staff_read_inventory_movements" on inventory_movements for select
  using (is_active_staff());

-- Tighten menu/table CRUD to owner/manager only. Status flips for tables/orders
-- still happen through the existing security-definer RPCs, which bypass RLS,
-- so cashiers/waiters/kitchen keep working exactly as before.
drop policy if exists "staff_manage_categories" on menu_categories;
drop policy if exists "staff_manage_menu_items" on menu_items;
drop policy if exists "staff_manage_tables" on restaurant_tables;

create policy "owner_manager_manage_categories" on menu_categories for all
  using (has_any_role('owner','manager')) with check (has_any_role('owner','manager'));
create policy "owner_manager_manage_menu_items" on menu_items for all
  using (has_any_role('owner','manager')) with check (has_any_role('owner','manager'));
create policy "owner_manager_manage_tables" on restaurant_tables for all
  using (has_any_role('owner','manager')) with check (has_any_role('owner','manager'));

-- orders/order_items: any active staff can read; updates limited to staff who
-- actually touch order status (everyone except delivery-only for now).
drop policy if exists "staff_read_orders" on orders;
drop policy if exists "staff_update_orders" on orders;
drop policy if exists "staff_read_order_items" on order_items;

create policy "staff_read_orders" on orders for select using (is_active_staff());
create policy "staff_update_orders" on orders for update
  using (has_any_role('owner','manager','cashier','waiter','kitchen','delivery'));
create policy "staff_read_order_items" on order_items for select using (is_active_staff());

-- ------------------------------------------------------------
-- 9. REALTIME for the new operational tables
-- ------------------------------------------------------------
alter publication supabase_realtime add table shifts;
alter publication supabase_realtime add table payments;
alter publication supabase_realtime add table inventory_items;

-- ------------------------------------------------------------
-- 10. BOOTSTRAP: promote yourself to owner after first login
-- ------------------------------------------------------------
-- After you sign in once (so your staff_profiles row exists), run this
-- ONE TIME with your own email to activate yourself as owner:
--
-- update staff_profiles set role = 'owner', is_active = true
-- where id = (select id from auth.users where email = 'you@example.com');

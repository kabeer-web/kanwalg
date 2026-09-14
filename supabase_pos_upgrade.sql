-- ============================================================
-- POS Checkout Upgrade — run AFTER supabase_restaurant_schema.sql
-- ============================================================

-- Human-readable, sequential order numbers (customers/receipts show this,
-- not the uuid).
create sequence if not exists order_number_seq start 1000;
alter table orders add column if not exists order_no int default nextval('order_number_seq');

-- Payment + pricing fields the original schema didn't need (customer-only
-- ordering had no discount/tax/payment concept — the POS does).
alter table orders add column if not exists discount_amount numeric not null default 0;
alter table orders add column if not exists tax_amount numeric not null default 0;
alter table orders add column if not exists service_charge_amount numeric not null default 0;
alter table orders add column if not exists payment_method text;
alter table orders add column if not exists amount_paid numeric;
alter table orders add column if not exists change_due numeric;
alter table orders add column if not exists is_paid boolean not null default false;

-- Allow walk-in/counter orders with no table, alongside dine_in/delivery.
alter table orders drop constraint if exists orders_order_type_check;
alter table orders add constraint orders_order_type_check
  check (order_type in ('dine_in','delivery','takeaway'));

-- ------------------------------------------------------------
-- RPC: pos_place_order — staff-only counter checkout.
-- Unlike place_order() (customer QR/delivery flow), this is for a cashier
-- ringing up an order at the counter: payment is collected immediately and
-- the order is sent straight to the kitchen (status 'confirmed'), skipping
-- the online-order verification step since staff created it in person.
-- ------------------------------------------------------------
create or replace function pos_place_order(
  p_order_type text,          -- 'dine_in' | 'takeaway'
  p_table_id uuid,            -- null for takeaway
  p_items jsonb,               -- [{"menu_item_id":"...", "qty":2, "notes":""}]
  p_discount_amount numeric,
  p_tax_amount numeric,
  p_service_charge_amount numeric,
  p_payment_method text,
  p_amount_paid numeric,
  p_change_due numeric
) returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_item jsonb;
  v_menu_item menu_items;
  v_subtotal numeric := 0;
  v_grand_total numeric;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Only staff can create POS orders';
  end if;
  if p_order_type not in ('dine_in','takeaway') then
    raise exception 'pos_place_order only supports dine_in or takeaway';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Order must have at least one item';
  end if;

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

  v_grand_total := v_subtotal - coalesce(p_discount_amount,0) + coalesce(p_tax_amount,0) + coalesce(p_service_charge_amount,0);

  insert into orders (
    order_type, table_id, status, subtotal, total,
    discount_amount, tax_amount, service_charge_amount,
    payment_method, amount_paid, change_due, is_paid, confirmed_at
  ) values (
    p_order_type, p_table_id, 'confirmed', v_subtotal, v_grand_total,
    coalesce(p_discount_amount,0), coalesce(p_tax_amount,0), coalesce(p_service_charge_amount,0),
    p_payment_method, p_amount_paid, p_change_due, true, now()
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid;
    insert into order_items (order_id, menu_item_id, item_name, price, qty, notes)
    values (v_order.id, v_menu_item.id, v_menu_item.name, v_menu_item.price, (v_item->>'qty')::int, v_item->>'notes');

    if v_menu_item.stock_qty is not null then
      update menu_items set stock_qty = stock_qty - (v_item->>'qty')::numeric where id = v_menu_item.id;
    end if;
  end loop;

  if p_table_id is not null then
    update restaurant_tables set status = 'occupied' where id = p_table_id;
  end if;

  return v_order;
end;
$$;

grant execute on function pos_place_order to authenticated;

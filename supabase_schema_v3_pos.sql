-- ============================================================
-- Restaurant POS — Schema v3: Staff-direct POS orders
-- Run AFTER supabase_schema_v2_operations.sql.
-- Additive: place_order (customer/QR flow) is untouched. This adds
-- a second, staff-only entry point for walk-in/dine-in/takeaway
-- orders created directly at the counter.
-- ============================================================

-- 'takeaway' wasn't a valid order_type before — customers only ever
-- ordered dine_in or delivery. Staff need it for counter walk-ins.
alter table orders drop constraint if exists orders_order_type_check;
alter table orders add constraint orders_order_type_check
  check (order_type in ('dine_in','delivery','takeaway'));

create or replace function staff_place_order(
  p_order_type text,               -- 'dine_in' | 'takeaway'
  p_table_id uuid default null,    -- required for dine_in
  p_items jsonb default '[]'::jsonb,
  p_discount_amount numeric default 0,
  p_tax_amount numeric default 0,
  p_service_charge_amount numeric default 0,
  p_shift_id uuid default null,
  p_notes text default null
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
  v_total numeric := 0;
begin
  if not has_any_role('owner','manager','cashier','waiter') then
    raise exception 'Not permitted to create POS orders';
  end if;
  if p_order_type not in ('dine_in','takeaway') then
    raise exception 'staff_place_order only supports dine_in or takeaway';
  end if;
  if p_order_type = 'dine_in' and p_table_id is null then
    raise exception 'A table is required for a dine-in order';
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

  v_total := greatest(v_subtotal - p_discount_amount, 0) + p_tax_amount + p_service_charge_amount;

  insert into orders (
    order_type, table_id, status, subtotal, discount_amount, tax_amount,
    service_charge_amount, total, notes, shift_id, confirmed_at
  ) values (
    p_order_type, p_table_id, 'confirmed', v_subtotal, p_discount_amount, p_tax_amount,
    p_service_charge_amount, v_total, p_notes, p_shift_id, now()
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

  perform write_audit_log('order.create_staff', 'orders', v_order.id,
    jsonb_build_object('order_type', p_order_type, 'total', v_total));

  return v_order;
end;
$$;

grant execute on function staff_place_order to authenticated;

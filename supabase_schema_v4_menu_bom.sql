-- ============================================================
-- BeerFlow Schema v4: Variants, Modifiers, Recipes/BOM,
-- Ingredient-driven stock, Order option snapshots
-- Run AFTER supabase_schema_v3_pos.sql
-- Fully additive — existing simple menu items keep working.
-- ============================================================

-- ------------------------------------------------------------
-- 1. MENU ITEMS extensions
-- ------------------------------------------------------------
alter table menu_items add column if not exists description text;
alter table menu_items add column if not exists has_variants boolean not null default false;
alter table menu_items add column if not exists archived_at timestamptz;

-- ------------------------------------------------------------
-- 2. VARIANTS (size / flavour)
-- ------------------------------------------------------------
create table if not exists menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,
  price numeric not null check (price >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_variants_item on menu_item_variants(menu_item_id);

-- ------------------------------------------------------------
-- 3. MODIFIERS (global add-ons)
-- ------------------------------------------------------------
create table if not exists modifiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0 check (price >= 0),
  is_available boolean not null default true,
  max_qty int not null default 5,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists menu_item_modifiers (
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  modifier_id uuid not null references modifiers(id) on delete cascade,
  primary key (menu_item_id, modifier_id)
);

-- ------------------------------------------------------------
-- 4. INGREDIENTS (refine inventory_items from v2)
-- ------------------------------------------------------------
alter table inventory_items add column if not exists supplier text;
alter table inventory_items add column if not exists is_active boolean not null default true;

-- Prefer movement type 'consumption' over 'sale' for recipe usage
alter table inventory_movements drop constraint if exists inventory_movements_movement_type_check;
alter table inventory_movements add constraint inventory_movements_movement_type_check
  check (movement_type in ('purchase','sale','consumption','waste','adjustment','return'));

-- ------------------------------------------------------------
-- 5. RECIPE / BOM lines
-- Exactly one of: menu_item_id (base product), variant_id, or modifier_id
-- ------------------------------------------------------------
create table if not exists recipe_lines (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid references menu_items(id) on delete cascade,
  variant_id uuid references menu_item_variants(id) on delete cascade,
  modifier_id uuid references modifiers(id) on delete cascade,
  ingredient_id uuid not null references inventory_items(id) on delete restrict,
  qty numeric not null check (qty > 0),
  created_at timestamptz default now(),
  constraint recipe_one_owner check (
    (menu_item_id is not null and variant_id is null and modifier_id is null) or
    (menu_item_id is null and variant_id is not null and modifier_id is null) or
    (menu_item_id is null and variant_id is null and modifier_id is not null)
  )
);
create index if not exists idx_recipe_item on recipe_lines(menu_item_id);
create index if not exists idx_recipe_variant on recipe_lines(variant_id);
create index if not exists idx_recipe_modifier on recipe_lines(modifier_id);
create index if not exists idx_recipe_ingredient on recipe_lines(ingredient_id);

-- ------------------------------------------------------------
-- 6. ORDER LINE OPTIONS (snapshots)
-- ------------------------------------------------------------
alter table order_items add column if not exists variant_id uuid;
alter table order_items add column if not exists variant_name text;
alter table order_items add column if not exists unit_price numeric; -- base+variant price before modifiers
alter table order_items add column if not exists modifiers_snapshot jsonb not null default '[]'::jsonb;
-- modifiers_snapshot: [{"id":"...","name":"Extra Cheese","price":150,"qty":2}]

-- ------------------------------------------------------------
-- 7. TABLES: expand status + capacity
-- ------------------------------------------------------------
alter table restaurant_tables add column if not exists capacity int default 4;
alter table restaurant_tables add column if not exists is_active boolean not null default true;
alter table restaurant_tables drop constraint if exists restaurant_tables_status_check;
alter table restaurant_tables add constraint restaurant_tables_status_check
  check (status in ('available','occupied','waiting_for_bill','cleaning','inactive','needs_bill'));

-- ------------------------------------------------------------
-- 8. Helper: collect BOM for a cart line (variant + modifiers)
-- Returns table (ingredient_id, total_qty)
-- ------------------------------------------------------------
create or replace function compute_line_ingredient_needs(
  p_menu_item_id uuid,
  p_variant_id uuid,
  p_modifiers jsonb,  -- [{"modifier_id":"...","qty":2}]
  p_qty int
) returns table (ingredient_id uuid, need_qty numeric)
language plpgsql
stable
set search_path = public
as $$
begin
  return query
  with base as (
    -- variant recipe preferred; else product-level recipe
    select rl.ingredient_id, rl.qty * p_qty as need
    from recipe_lines rl
    where (p_variant_id is not null and rl.variant_id = p_variant_id)
       or (p_variant_id is null and rl.menu_item_id = p_menu_item_id)
    union all
    select rl.ingredient_id, rl.qty * p_qty * coalesce((m->>'qty')::numeric, 1)
    from jsonb_array_elements(coalesce(p_modifiers, '[]'::jsonb)) m
    join recipe_lines rl on rl.modifier_id = (m->>'modifier_id')::uuid
  )
  select b.ingredient_id, sum(b.need)::numeric
  from base b
  group by b.ingredient_id;
end;
$$;

-- ------------------------------------------------------------
-- 9. Validate + reserve ingredients for a full order payload
-- Raises exception if any ingredient insufficient
-- ------------------------------------------------------------
create or replace function validate_ingredient_stock(p_items jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_need record;
  v_stock numeric;
  v_name text;
  v_agg jsonb := '{}'::jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    for v_need in
      select * from compute_line_ingredient_needs(
        (v_item->>'menu_item_id')::uuid,
        nullif(v_item->>'variant_id','')::uuid,
        coalesce(v_item->'modifiers', '[]'::jsonb),
        (v_item->>'qty')::int
      )
    loop
      v_agg := jsonb_set(
        v_agg,
        array[v_need.ingredient_id::text],
        to_jsonb(coalesce((v_agg->>v_need.ingredient_id::text)::numeric, 0) + v_need.need_qty)
      );
    end loop;
  end loop;

  for v_need in
    select key::uuid as ingredient_id, value::numeric as need_qty
    from jsonb_each_text(v_agg)
  loop
    select current_stock, name into v_stock, v_name
    from inventory_items where id = v_need.ingredient_id and is_active = true;
    if v_stock is null then
      raise exception 'Ingredient missing or inactive for recipe';
    end if;
    if v_stock < v_need.need_qty then
      raise exception 'Insufficient stock for %: need %, have %', v_name, v_need.need_qty, v_stock;
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 10. Consume ingredients + write movements (called inside order tx)
-- ------------------------------------------------------------
create or replace function consume_ingredients_for_order(p_order_id uuid, p_items jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_need record;
  v_agg jsonb := '{}'::jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    for v_need in
      select * from compute_line_ingredient_needs(
        (v_item->>'menu_item_id')::uuid,
        nullif(v_item->>'variant_id','')::uuid,
        coalesce(v_item->'modifiers', '[]'::jsonb),
        (v_item->>'qty')::int
      )
    loop
      v_agg := jsonb_set(
        v_agg,
        array[v_need.ingredient_id::text],
        to_jsonb(coalesce((v_agg->>v_need.ingredient_id::text)::numeric, 0) + v_need.need_qty)
      );
    end loop;
  end loop;

  for v_need in
    select key::uuid as ingredient_id, value::numeric as need_qty
    from jsonb_each_text(v_agg)
  loop
    update inventory_items
    set current_stock = current_stock - v_need.need_qty, updated_at = now()
    where id = v_need.ingredient_id;

    insert into inventory_movements (inventory_item_id, movement_type, qty, notes, created_by)
    values (v_need.ingredient_id, 'consumption', -v_need.need_qty,
            'Order ' || p_order_id::text, auth.uid());
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 11. Upgraded place_order (customer QR / delivery)
-- Accepts optional variant_id + modifiers per line.
-- Server computes price; never trusts client price.
-- p_items: [{"menu_item_id","qty","notes","variant_id","modifiers":[{"modifier_id","qty"}]}]
-- ------------------------------------------------------------
create or replace function place_order(
  p_order_type text,
  p_table_qr_token uuid,
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
  v_variant menu_item_variants;
  v_mod modifiers;
  v_subtotal numeric := 0;
  v_status text;
  v_line_price numeric;
  v_mod_snap jsonb;
  v_mod_el jsonb;
  v_mod_qty int;
  v_unit numeric;
begin
  if p_order_type = 'dine_in' then
    select id into v_table_id from restaurant_tables
      where qr_token = p_table_qr_token and is_active = true and status <> 'inactive';
    if v_table_id is null then
      raise exception 'Invalid table QR code';
    end if;
    v_status := 'confirmed';
  elsif p_order_type = 'delivery' then
    v_table_id := null;
    v_status := 'pending_confirmation';
  else
    raise exception 'order_type must be dine_in or delivery';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Order must have at least one item';
  end if;

  -- Ingredient availability (BOM)
  perform validate_ingredient_stock(p_items);

  -- Validate items + compute subtotal from server prices
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item from menu_items
      where id = (v_item->>'menu_item_id')::uuid and archived_at is null;
    if v_menu_item is null or not v_menu_item.is_available then
      raise exception 'Item not available';
    end if;

    v_unit := v_menu_item.price;
    if v_item->>'variant_id' is not null and v_item->>'variant_id' <> '' then
      select * into v_variant from menu_item_variants
        where id = (v_item->>'variant_id')::uuid and menu_item_id = v_menu_item.id;
      if v_variant is null or not v_variant.is_available then
        raise exception 'Variant not available for %', v_menu_item.name;
      end if;
      v_unit := v_variant.price;
    end if;

    -- legacy sellable stock (optional)
    if v_menu_item.stock_qty is not null and v_menu_item.stock_qty < (v_item->>'qty')::numeric then
      raise exception 'Not enough stock for %', v_menu_item.name;
    end if;

    v_line_price := v_unit * (v_item->>'qty')::numeric;

    for v_mod_el in select * from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb))
    loop
      select * into v_mod from modifiers where id = (v_mod_el->>'modifier_id')::uuid;
      if v_mod is null or not v_mod.is_available then
        raise exception 'Modifier not available';
      end if;
      v_mod_qty := greatest(coalesce((v_mod_el->>'qty')::int, 1), 1);
      v_line_price := v_line_price + (v_mod.price * v_mod_qty * (v_item->>'qty')::numeric);
    end loop;

    v_subtotal := v_subtotal + v_line_price;
  end loop;

  insert into orders (order_type, table_id, customer_name, customer_phone, delivery_address,
                      status, subtotal, total, confirmed_at)
  values (p_order_type, v_table_id, p_customer_name, p_customer_phone, p_delivery_address,
          v_status, v_subtotal, v_subtotal,
          case when v_status = 'confirmed' then now() else null end)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid;
    v_unit := v_menu_item.price;
    v_variant := null;
    if v_item->>'variant_id' is not null and v_item->>'variant_id' <> '' then
      select * into v_variant from menu_item_variants where id = (v_item->>'variant_id')::uuid;
      v_unit := v_variant.price;
    end if;

    v_mod_snap := '[]'::jsonb;
    for v_mod_el in select * from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb))
    loop
      select * into v_mod from modifiers where id = (v_mod_el->>'modifier_id')::uuid;
      v_mod_qty := greatest(coalesce((v_mod_el->>'qty')::int, 1), 1);
      v_mod_snap := v_mod_snap || jsonb_build_array(jsonb_build_object(
        'id', v_mod.id, 'name', v_mod.name, 'price', v_mod.price, 'qty', v_mod_qty
      ));
    end loop;

    insert into order_items (
      order_id, menu_item_id, item_name, price, qty, notes,
      variant_id, variant_name, unit_price, modifiers_snapshot
    ) values (
      v_order.id, v_menu_item.id, v_menu_item.name,
      v_unit + coalesce((
        select sum((m->>'price')::numeric * (m->>'qty')::numeric)
        from jsonb_array_elements(v_mod_snap) m
      ), 0),
      (v_item->>'qty')::int, v_item->>'notes',
      v_variant.id, v_variant.name, v_unit, v_mod_snap
    );

    if v_menu_item.stock_qty is not null then
      update menu_items set stock_qty = stock_qty - (v_item->>'qty')::numeric where id = v_menu_item.id;
    end if;
  end loop;

  -- Ingredient consumption only when confirmed (dine-in); delivery waits until confirm_order
  if v_status = 'confirmed' then
    perform consume_ingredients_for_order(v_order.id, p_items);
  end if;

  if v_table_id is not null then
    update restaurant_tables set status = 'occupied' where id = v_table_id;
  end if;

  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- 12. confirm_order — also consume ingredients for delivery
-- ------------------------------------------------------------
create or replace function confirm_order(p_order_id uuid)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_items jsonb;
begin
  update orders set status = 'confirmed', confirmed_at = now()
  where id = p_order_id and status = 'pending_confirmation'
  returning * into v_order;
  if v_order is null then raise exception 'Order not found or already confirmed'; end if;

  -- Rebuild payload from order_items for consumption
  select coalesce(jsonb_agg(jsonb_build_object(
    'menu_item_id', oi.menu_item_id,
    'qty', oi.qty,
    'variant_id', oi.variant_id,
    'modifiers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'modifier_id', m->>'id', 'qty', m->>'qty'
      )), '[]'::jsonb)
      from jsonb_array_elements(oi.modifiers_snapshot) m
    )
  )), '[]'::jsonb)
  into v_items
  from order_items oi where oi.order_id = p_order_id;

  perform validate_ingredient_stock(v_items);
  perform consume_ingredients_for_order(p_order_id, v_items);

  perform write_audit_log('order.confirm', 'orders', v_order.id, '{}'::jsonb);
  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- 13. staff_place_order upgraded for variants/modifiers
-- ------------------------------------------------------------
create or replace function staff_place_order(
  p_order_type text,
  p_table_id uuid default null,
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
  v_variant menu_item_variants;
  v_mod modifiers;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_unit numeric;
  v_mod_snap jsonb;
  v_mod_el jsonb;
  v_mod_qty int;
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

  perform validate_ingredient_stock(p_items);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item from menu_items
      where id = (v_item->>'menu_item_id')::uuid and archived_at is null;
    if v_menu_item is null or not v_menu_item.is_available then
      raise exception 'Item not available';
    end if;
    v_unit := v_menu_item.price;
    if v_item->>'variant_id' is not null and v_item->>'variant_id' <> '' then
      select * into v_variant from menu_item_variants
        where id = (v_item->>'variant_id')::uuid and menu_item_id = v_menu_item.id;
      if v_variant is null or not v_variant.is_available then
        raise exception 'Variant not available';
      end if;
      v_unit := v_variant.price;
    end if;
    if v_menu_item.stock_qty is not null and v_menu_item.stock_qty < (v_item->>'qty')::numeric then
      raise exception 'Not enough stock for %', v_menu_item.name;
    end if;
    v_subtotal := v_subtotal + v_unit * (v_item->>'qty')::numeric;
    for v_mod_el in select * from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb))
    loop
      select * into v_mod from modifiers where id = (v_mod_el->>'modifier_id')::uuid and is_available;
      if v_mod is null then raise exception 'Modifier not available'; end if;
      v_mod_qty := greatest(coalesce((v_mod_el->>'qty')::int, 1), 1);
      v_subtotal := v_subtotal + v_mod.price * v_mod_qty * (v_item->>'qty')::numeric;
    end loop;
  end loop;

  v_total := greatest(v_subtotal - coalesce(p_discount_amount,0), 0)
             + coalesce(p_tax_amount,0) + coalesce(p_service_charge_amount,0);

  insert into orders (
    order_type, table_id, status, subtotal, discount_amount, tax_amount,
    service_charge_amount, total, notes, shift_id, confirmed_at
  ) values (
    p_order_type, p_table_id, 'confirmed', v_subtotal, coalesce(p_discount_amount,0),
    coalesce(p_tax_amount,0), coalesce(p_service_charge_amount,0), v_total, p_notes, p_shift_id, now()
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid;
    v_unit := v_menu_item.price;
    v_variant := null;
    if v_item->>'variant_id' is not null and v_item->>'variant_id' <> '' then
      select * into v_variant from menu_item_variants where id = (v_item->>'variant_id')::uuid;
      v_unit := v_variant.price;
    end if;
    v_mod_snap := '[]'::jsonb;
    for v_mod_el in select * from jsonb_array_elements(coalesce(v_item->'modifiers','[]'::jsonb))
    loop
      select * into v_mod from modifiers where id = (v_mod_el->>'modifier_id')::uuid;
      v_mod_qty := greatest(coalesce((v_mod_el->>'qty')::int, 1), 1);
      v_mod_snap := v_mod_snap || jsonb_build_array(jsonb_build_object(
        'id', v_mod.id, 'name', v_mod.name, 'price', v_mod.price, 'qty', v_mod_qty
      ));
    end loop;

    insert into order_items (
      order_id, menu_item_id, item_name, price, qty, notes,
      variant_id, variant_name, unit_price, modifiers_snapshot
    ) values (
      v_order.id, v_menu_item.id, v_menu_item.name,
      v_unit + coalesce((select sum((m->>'price')::numeric*(m->>'qty')::numeric) from jsonb_array_elements(v_mod_snap) m),0),
      (v_item->>'qty')::int, v_item->>'notes',
      v_variant.id, v_variant.name, v_unit, v_mod_snap
    );

    if v_menu_item.stock_qty is not null then
      update menu_items set stock_qty = stock_qty - (v_item->>'qty')::numeric where id = v_menu_item.id;
    end if;
  end loop;

  perform consume_ingredients_for_order(v_order.id, p_items);

  if p_table_id is not null then
    update restaurant_tables set status = 'occupied' where id = p_table_id;
  end if;

  perform write_audit_log('order.create_staff', 'orders', v_order.id,
    jsonb_build_object('order_type', p_order_type, 'total', v_total));
  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- 14. Product food cost helper (owner/manager)
-- ------------------------------------------------------------
create or replace function product_food_cost(p_menu_item_id uuid, p_variant_id uuid default null)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(rl.qty * ii.cost_per_unit), 0)
  from recipe_lines rl
  join inventory_items ii on ii.id = rl.ingredient_id
  where (p_variant_id is not null and rl.variant_id = p_variant_id)
     or (p_variant_id is null and rl.menu_item_id = p_menu_item_id);
$$;

-- ------------------------------------------------------------
-- 15. RLS for new tables
-- ------------------------------------------------------------
alter table menu_item_variants enable row level security;
alter table modifiers enable row level security;
alter table menu_item_modifiers enable row level security;
alter table recipe_lines enable row level security;

create policy "public_read_variants" on menu_item_variants for select using (true);
create policy "owner_manager_variants" on menu_item_variants for all
  using (has_any_role('owner','manager')) with check (has_any_role('owner','manager'));

create policy "public_read_modifiers" on modifiers for select using (true);
create policy "owner_manager_modifiers" on modifiers for all
  using (has_any_role('owner','manager')) with check (has_any_role('owner','manager'));

create policy "public_read_item_modifiers" on menu_item_modifiers for select using (true);
create policy "owner_manager_item_modifiers" on menu_item_modifiers for all
  using (has_any_role('owner','manager')) with check (has_any_role('owner','manager'));

create policy "staff_read_recipes" on recipe_lines for select using (is_active_staff());
create policy "owner_manager_recipes" on recipe_lines for all
  using (has_any_role('owner','manager')) with check (has_any_role('owner','manager'));

grant execute on function place_order to anon, authenticated;
grant execute on function confirm_order to authenticated;
grant execute on function staff_place_order to authenticated;
grant execute on function product_food_cost to authenticated;
grant execute on function validate_ingredient_stock to authenticated;

-- Realtime
alter publication supabase_realtime add table inventory_items;

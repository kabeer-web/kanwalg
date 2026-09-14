-- Kanwal G Restaurant — DEMO DATA
-- Safe to re-run. Handles existing tables / categories / items.

alter table menu_items add column if not exists description text;
alter table menu_items add column if not exists has_variants boolean not null default false;
alter table menu_items add column if not exists archived_at timestamptz;
alter table inventory_items add column if not exists is_active boolean not null default true;
alter table restaurant_tables add column if not exists is_active boolean not null default true;

create table if not exists menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,
  price numeric not null check (price >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists recipe_lines (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid references menu_items(id) on delete cascade,
  variant_id uuid references menu_item_variants(id) on delete cascade,
  modifier_id uuid,
  ingredient_id uuid not null references inventory_items(id) on delete restrict,
  qty numeric not null check (qty > 0),
  created_at timestamptz default now()
);

insert into menu_categories (id, name, sort_order) values
  ('a1000001-0000-4000-8000-000000000001', 'Pizza', 1),
  ('a1000001-0000-4000-8000-000000000002', 'Burgers', 2),
  ('a1000001-0000-4000-8000-000000000003', 'Drinks', 3),
  ('a1000001-0000-4000-8000-000000000004', 'Desserts', 4)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into menu_items (id, category_id, name, price, stock_qty, is_available, image_url, description, has_variants) values
  ('b1000001-0000-4000-8000-000000000001', 'a1000001-0000-4000-8000-000000000001', 'Chicken Tikka Pizza', 999, null, true,
   'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop',
   'Tandoori chicken, mozzarella, house sauce', true),
  ('b1000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000001', 'Fajita Pizza', 1099, null, true,
   'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop',
   'Fajita chicken, peppers, onions', true),
  ('b1000001-0000-4000-8000-000000000003', 'a1000001-0000-4000-8000-000000000002', 'Classic Beef Burger', 649, 50, true,
   'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
   'Angus beef, cheddar, fries sauce', false),
  ('b1000001-0000-4000-8000-000000000004', 'a1000001-0000-4000-8000-000000000002', 'Zinger Burger', 549, 40, true,
   'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop',
   'Crispy chicken fillet, mayo', false),
  ('b1000001-0000-4000-8000-000000000005', 'a1000001-0000-4000-8000-000000000003', 'Fresh Lime', 199, null, true,
   'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop',
   'Fresh squeezed lime soda', false),
  ('b1000001-0000-4000-8000-000000000006', 'a1000001-0000-4000-8000-000000000003', 'Cold Coffee', 299, null, true,
   'https://images.unsplash.com/photo-1517701550927-30cf4ba1a69a?w=400&h=300&fit=crop',
   'Iced coffee with cream', false),
  ('b1000001-0000-4000-8000-000000000007', 'a1000001-0000-4000-8000-000000000004', 'Chocolate Brownie', 349, 20, true,
   'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&h=300&fit=crop',
   'Warm brownie with chocolate sauce', false)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  image_url = excluded.image_url,
  description = excluded.description,
  is_available = true,
  has_variants = excluded.has_variants;

insert into menu_item_variants (id, menu_item_id, name, price, is_available, sort_order) values
  ('c1000001-0000-4000-8000-000000000001', 'b1000001-0000-4000-8000-000000000001', 'Small', 799, true, 1),
  ('c1000001-0000-4000-8000-000000000002', 'b1000001-0000-4000-8000-000000000001', 'Medium', 999, true, 2),
  ('c1000001-0000-4000-8000-000000000003', 'b1000001-0000-4000-8000-000000000001', 'Large', 1299, true, 3),
  ('c1000001-0000-4000-8000-000000000004', 'b1000001-0000-4000-8000-000000000002', 'Small', 849, true, 1),
  ('c1000001-0000-4000-8000-000000000005', 'b1000001-0000-4000-8000-000000000002', 'Medium', 1099, true, 2),
  ('c1000001-0000-4000-8000-000000000006', 'b1000001-0000-4000-8000-000000000002', 'Large', 1399, true, 3)
on conflict (id) do update set name = excluded.name, price = excluded.price, is_available = true;

insert into inventory_items (id, name, unit, current_stock, low_stock_threshold, cost_per_unit, is_active) values
  ('d1000001-0000-4000-8000-000000000001', 'Pizza Dough', 'pcs', 80, 15, 40, true),
  ('d1000001-0000-4000-8000-000000000002', 'Mozzarella', 'kg', 12, 3, 800, true),
  ('d1000001-0000-4000-8000-000000000003', 'Chicken Tikka', 'kg', 8, 2, 600, true),
  ('d1000001-0000-4000-8000-000000000004', 'Beef Patty', 'pcs', 60, 10, 120, true),
  ('d1000001-0000-4000-8000-000000000005', 'Burger Bun', 'pcs', 70, 15, 25, true),
  ('d1000001-0000-4000-8000-000000000006', 'Lime', 'kg', 1.5, 2, 150, true)
on conflict (id) do update set
  current_stock = excluded.current_stock,
  low_stock_threshold = excluded.low_stock_threshold,
  is_active = true;

delete from recipe_lines where
  variant_id in (
    'c1000001-0000-4000-8000-000000000001',
    'c1000001-0000-4000-8000-000000000002',
    'c1000001-0000-4000-8000-000000000003'
  )
  or menu_item_id = 'b1000001-0000-4000-8000-000000000003';

insert into recipe_lines (variant_id, ingredient_id, qty) values
  ('c1000001-0000-4000-8000-000000000001', 'd1000001-0000-4000-8000-000000000001', 1),
  ('c1000001-0000-4000-8000-000000000001', 'd1000001-0000-4000-8000-000000000002', 0.15),
  ('c1000001-0000-4000-8000-000000000001', 'd1000001-0000-4000-8000-000000000003', 0.12),
  ('c1000001-0000-4000-8000-000000000002', 'd1000001-0000-4000-8000-000000000001', 1),
  ('c1000001-0000-4000-8000-000000000002', 'd1000001-0000-4000-8000-000000000002', 0.22),
  ('c1000001-0000-4000-8000-000000000002', 'd1000001-0000-4000-8000-000000000003', 0.18),
  ('c1000001-0000-4000-8000-000000000003', 'd1000001-0000-4000-8000-000000000001', 1),
  ('c1000001-0000-4000-8000-000000000003', 'd1000001-0000-4000-8000-000000000002', 0.30),
  ('c1000001-0000-4000-8000-000000000003', 'd1000001-0000-4000-8000-000000000003', 0.25);

insert into recipe_lines (menu_item_id, ingredient_id, qty) values
  ('b1000001-0000-4000-8000-000000000003', 'd1000001-0000-4000-8000-000000000004', 1),
  ('b1000001-0000-4000-8000-000000000003', 'd1000001-0000-4000-8000-000000000005', 1);

-- Tables: conflict on table_number (already exists in your DB)
insert into restaurant_tables (id, table_number, qr_token, status) values
  ('e1000001-0000-4000-8000-000000000001', '1', 'f1000001-0000-4000-8000-000000000001', 'available'),
  ('e1000001-0000-4000-8000-000000000002', '2', 'f1000001-0000-4000-8000-000000000002', 'available'),
  ('e1000001-0000-4000-8000-000000000003', '3', 'f1000001-0000-4000-8000-000000000003', 'available'),
  ('e1000001-0000-4000-8000-000000000004', '4', 'f1000001-0000-4000-8000-000000000004', 'available'),
  ('e1000001-0000-4000-8000-000000000005', '5', 'f1000001-0000-4000-8000-000000000005', 'available')
on conflict (table_number) do update set
  qr_token = excluded.qr_token,
  status = 'available';

update restaurant_tables set is_active = true where table_number in ('1','2','3','4','5');

select 'Demo data loaded OK' as message;

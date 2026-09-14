# Restaurant POS & Ordering System

Built on Vite + React + Tailwind CSS + Supabase (same stack as your original project).

## Setup

1. Create a new Supabase project (or reuse an existing empty one).
2. Run `supabase_restaurant_schema.sql` in the SQL Editor. It creates all
   tables, RLS policies, realtime subscriptions, and seeds 5 tables + 4
   categories to start with.
3. In Authentication -> Users, manually create your staff account(s) (this
   app has no public staff signup — only pre-created users can log in).
4. Copy `.env.example` to `.env` and fill in your project's URL + publishable
   (anon) key from Project Settings -> API.
5. `npm install && npm run dev`.

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/menu?table=<qr_token>` | Customer (dine-in) | Table-locked ordering — table can't be changed |
| `/menu` | Customer (delivery) | Enter name/phone/address, order goes to "Pending Confirmation" |
| `/login` | Staff | Sign in |
| `/dashboard` | Staff | Counter screen — table statuses, confirm deliveries, active orders |
| `/kds` | Staff (kitchen) | Live incoming orders, Start Preparing / Mark Ready |
| `/billing` | Staff | Orders marked "ready" — print bill, mark paid |
| `/menu-admin` | Staff | CRUD for categories, items, prices, stock |
| `/tables` | Staff | Generate/print/regenerate each table's QR code |

## Order lifecycle

```
Dine-in:   scan QR -> order -> confirmed -> preparing -> ready -> completed
Delivery:  order -> pending_confirmation -> (staff confirms) -> confirmed -> preparing -> ready -> completed
```

All state changes go through Postgres RPC functions (`place_order`,
`confirm_order`, `update_order_status`) so stock deduction, order totals,
and table status stay consistent even under concurrent orders — never
mutated directly from the frontend.

## Notes / things to adjust for production

- The table QR page uses a public QR-image API (`api.qrserver.com`) to avoid
  extra dependencies — swap for a local QR library if you need it to work
  offline.
- `restaurant_tables`, `menu_categories`, and `menu_items` are readable by
  anyone (needed for the public menu) — nothing sensitive lives in them.
- `orders`/`order_items` are staff-only to read; customers never see other
  customers' phone numbers or addresses.
- Add a payment gateway integration in Billing.jsx if you want online
  payment instead of pay-on-pickup/delivery.

## Schema migrations (run in order in Supabase SQL Editor)

1. `supabase_restaurant_schema.sql`
2. `supabase_schema_v2_operations.sql`
3. `supabase_schema_v3_pos.sql` (or `supabase_pos_upgrade.sql`)
4. **`supabase_schema_v4_menu_bom.sql`** — variants, modifiers, recipes/BOM, ingredient deduction

### v4 features
- Product variants (sizes/flavours) with own prices
- Global modifiers / add-ons
- Recipe / BOM lines per product or variant
- Automatic ingredient validation + consumption on order
- Ingredients admin UI (`/ingredients`)
- Audit History page (`/history`)
- Dashboard KPIs from real order & inventory data

### Staff setup
After first login, activate your profile as owner:
```sql
update staff_profiles set role = 'owner', is_active = true
where id = (select id from auth.users where email = 'you@example.com');
```

# Kanwal G — Presentation Guide

## Setup once
1. npm install && npm run dev
2. Supabase: run schemas in order, then `seed_demo_data.sql`
3. Activate your staff user as owner

## Demo (2–3 min)
1. **Website** http://localhost:5173/ — show menu, photos, pizza sizes
2. **Dashboard** /login — sales cards, low stock (Lime is low)
3. Order from website: Chicken Tikka → Medium → checkout
4. Dashboard: notification + Pending → Confirm → Kitchen
5. KDS: Start Preparing → Mark Ready
6. Billing: take payment
7. Optional: Menu & Stock add item → appears on website
8. Optional: /menu?table=kanwal-table-01 for dine-in QR

## What works
- Live menu + sizes + images
- Website → dashboard orders + sound toast
- Kitchen → Ready → Billing
- Ingredients + BOM (recipe) + deduction on confirm (RPC)
- Tables QR tokens
- Roles (owner/manager/cashier/kitchen via staff_profiles)

## Honest limits
- Card gateway not integrated
- SMS not integrated  
- Website modifiers UI basic (variants yes)

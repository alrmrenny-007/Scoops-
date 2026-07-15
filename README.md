# Scoops Chops & Drinks × Mr. Jollof — Online Ordering

Plain HTML/CSS/JS frontend, Supabase backend. Built around the real menu, combo deals, and birthday packages from the brand's flyers. Dark theme by default, with a light-mode toggle in the top bar.

## Run it
Just open `index.html` in a browser, or serve the folder (`npx serve .`). It works immediately using built-in demo data (the full real menu, deals, and birthday packages) — no setup required to see it running.

## Connect Supabase
1. Create a project at supabase.com.
2. Open **SQL Editor** → paste and run `schema.sql`. This creates `dishes`, `deals`, `birthday_packages`, and `orders` tables, sets up row-level security, and seeds the entire real menu plus all 7 combo deals and the 3 birthday tiers.
3. In **Project Settings → API**, copy your **Project URL** and **anon public key**.
4. Paste them into `supabase-client.js`:
   ```js
   const SUPABASE_URL = 'https://xxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```
5. Reload — the app pulls dishes, deals, and birthday packages live from Supabase, and checkout inserts real rows into `orders`.

## Product photos (new)
Dishes without a photo show a clean category-icon placeholder instead of a broken image or blank space — nothing looks unfinished while you're still adding photos.

**To add a real photo to a dish, from your phone:**
1. In Supabase, go to **Storage** (left sidebar) → **New bucket** → name it `menu-images` → toggle **Public bucket** on → Create.
2. Open the bucket → **Upload file** → pick a photo from your phone.
3. Tap the uploaded file → copy its **public URL** (Supabase shows a "Get URL" or copy-link option).
4. Go to `admin.html` → **Menu** tab → find the dish → paste the URL into the **Photo URL** field → **Save**.

The photo appears on the live menu immediately — no redeploy needed, since it's stored in the database, not in your code. You can do this one dish at a time whenever you have a photo ready.

## Migration note
If you already ran the original `schema.sql` and have live data (staff account, real orders), **don't re-run the whole file again** — it drops and recreates every table. For the photo feature, just run this small addition once in the SQL Editor:
```sql
alter table dishes add column if not exists image_url text;
alter table deals add column if not exists image_url text;
```

## Customer accounts (updated)
Login/signup now lives on its own page — **`account.html`** — instead of a sidebar drawer. Tapping **Profile** in the bottom nav takes you there directly.
- Not logged in → clean centered login/signup card (same pattern as the staff dashboard).
- Logged in → two tabs: **My details** (name/phone/default address, auto-fills checkout) and **Order history** (real orders with live status once Supabase is connected).
- Sessions persist automatically across pages — log in once on `account.html`, and `index.html` will recognize you and prefill checkout without asking again.

## Layout stability (fixed)
Menu/deals/birthday sections previously rendered empty until the Supabase data finished loading, causing the whole page to jump once content popped in — most noticeable on slower mobile connections. Fixed by baking skeleton placeholder cards directly into `index.html` (not JS-generated), so there's stable, shimmer-animated content on first paint before any network request finishes. JS swaps them for real content once data arrives.

## Staff / admin dashboard (new)
A separate page at **`admin.html`** — not linked from the customer site — for managing the business:
- **Orders tab**: every incoming order with customer name/phone/address/notes, and one-tap buttons to advance status (Order received → Preparing → Out for delivery → Delivered) or cancel. Auto-refreshes every 20s.
- **Menu tab**: toggle any dish "Sold out" — it immediately disables ordering for that item on the customer site.
- **Access control**: only accounts with `is_staff = true` in the `profiles` table can log in here. To make your first staff account:
  1. Sign up for a normal account on the customer site (or directly in Supabase Auth).
  2. In Supabase SQL Editor, run:
     ```sql
     update profiles set is_staff = true where id =
       (select id from auth.users where email = 'staff@example.com');
     ```
  3. Log in at `admin.html` with that account.

## Checkout & order tracking (new)
- **Checkout** now walks through: cart → delivery details (name, phone, delivery/pickup, address, notes) → confirmation. Works even before Supabase is connected — orders are saved locally so the flow is fully testable today.
- **Orders tab** (bottom nav) shows order history with a simulated status timeline (Order received → Preparing → Out for delivery → Delivered) based on time elapsed since the order was placed. Once you wire up a real admin view, swap `computeStatus()` in `main.js` for the actual `status` column from Supabase.
- Once Supabase is connected, `placeOrder()` automatically starts writing to the real `orders` table (with customer name/phone/address/notes) instead of the local fallback.

## What's included
- **Full menu** — shawarma, pizza, burgers, fries & sides, milkshakes, ice cream, snacks, drinks, rice & spaghetti, noodles, protein add-ons. Items with sizes (Small/Medium/Big, Single/Double) show a size selector that updates the price live.
- **Today's deals** — all 7 combo offers (Breakfast Budget/Feast/Deluxe, Jinja Family Combo, Jinja Combo, Jinja Max, Stay Sweet) with strikethrough pricing and "you save" badges, matching the flyer style.
- **Birthday offers** — Basic / Flex / Experience tiers, each with an "Enquire on WhatsApp" button pre-filled with the tier name, sent to 07087662962.
- **Contact footer** — call and WhatsApp buttons, plus the Makurdi location.

## Add authentication (optional)
`supabase-client.js` already exports `signUp` / `signIn` using Supabase Auth (email/password). Wire these to a login form when you're ready — orders will then attach to the logged-in user via `user_id`.

## File map
- `index.html` — customer site structure (deals, menu, birthday packages, cart/checkout, footer)
- `style.css` — shared brand tokens (Scoops red + gold, dark/light via `data-theme`), all customer-site components, skeleton loaders
- `main.js` — customer site logic: rendering, filtering, cart, checkout, session check, order tracking
- `account.html` / `account.js` — dedicated login/signup + account page (profile details, order history)
- `admin.html` / `admin.css` / `admin.js` — staff dashboard (orders + menu availability), gated by `profiles.is_staff`
- `supabase-client.js` — all Supabase calls: menu data, auth, profiles, orders, staff actions
- `schema.sql` — database schema, RLS policies, and full seed data

## Notes
- Cart persists in `localStorage`.
- Prices are plain integers (₦).
- To swap in real food photography, add an `image` column to `dishes`/`deals` (or use Supabase Storage) and reference it in `main.js`'s render functions — the current build is text/price-forward since no product photos were provided.

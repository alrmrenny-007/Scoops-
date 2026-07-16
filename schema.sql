-- ============================================================
-- Scoops Chops & Drinks × Mr. Jollof — Supabase schema
-- Run this in Supabase → SQL Editor
-- ============================================================

create table dishes (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,          -- shawarma, pizza, burger, sides, milkshake, dessert,
                                    -- snacks, drinks, rice, noodles, protein
  description text,
  price integer,                   -- used when the item has one price
  sizes jsonb,                     -- used when the item has size variants:
                                    -- e.g. [{"label":"Small","price":3000},{"label":"Big","price":3800}]
  image_url text,                  -- photo URL, set from admin.html — null shows a placeholder icon
  is_available boolean default true,
  created_at timestamptz default now()
);

create table deals (
  id text primary key,             -- e.g. 'd1'
  name text not null,
  items text not null,             -- human-readable contents, e.g. "Shawarma + Fries + Milkshake"
  was integer not null,
  price integer not null,
  save integer not null,
  badge text,                      -- e.g. "15% OFF"
  note text,                       -- e.g. "Everyday, 7:30am – 11am"
  image_url text,
  created_at timestamptz default now()
);

create table birthday_packages (
  id bigint generated always as identity primary key,
  tier text not null,              -- Basic, Flex, Experience
  cost integer not null,
  voucher integer not null,
  perks jsonb not null,            -- array of strings
  featured boolean default false,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  phone text,
  default_address text,
  is_staff boolean default false,  -- set true manually in Supabase Table Editor for staff accounts
  created_at timestamptz default now()
);

create table orders (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  items jsonb not null,
  total integer not null,
  status text default 'pending',   -- pending | preparing | out_for_delivery | delivered | cancelled
  customer_name text,
  phone text,
  delivery_type text,              -- 'delivery' | 'pickup'
  address text,
  notes text,
  created_at timestamptz default now()
);

-- ---------- ROW LEVEL SECURITY ----------
alter table dishes enable row level security;
alter table deals enable row level security;
alter table birthday_packages enable row level security;
alter table profiles enable row level security;
alter table orders enable row level security;

create policy "Public read dishes" on dishes for select using (true);
create policy "Public read deals" on deals for select using (true);
create policy "Public read birthday_packages" on birthday_packages for select using (true);

-- Profiles: a user can only see/edit their own profile
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Helper function: is the current user a staff member?
-- SECURITY DEFINER makes this bypass RLS internally — required because a policy
-- ON profiles that queries profiles again (to check is_staff) would otherwise
-- recurse into itself infinitely ("infinite recursion detected in policy").
create or replace function public.is_staff_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_staff from profiles where id = auth.uid()), false);
$$;

-- Orders: customers see only their own; staff see and update everything
create policy "Users read own orders" on orders for select using (
  auth.uid() = user_id or is_staff_user()
);
-- Guest checkouts (no account) have user_id = NULL. "auth.uid() = NULL" is never
-- true in SQL (even for the same guest), so without this, a guest's own order
-- couldn't be read back immediately after being placed — this fixes that.
create policy "Guest orders are readable" on orders for select using (user_id is null);
create policy "Users insert own orders" on orders for insert with check (
  auth.uid() = user_id or user_id is null
);
create policy "Staff update orders" on orders for update using (is_staff_user());
create policy "Staff delete orders" on orders for delete using (is_staff_user());

-- Dishes: only staff can create/edit/delete
create policy "Staff update dishes" on dishes for update using (is_staff_user());
create policy "Staff insert dishes" on dishes for insert with check (is_staff_user());
create policy "Staff delete dishes" on dishes for delete using (is_staff_user());

-- Staff can see every customer profile (for the admin Customers list)
create policy "Staff read all profiles" on profiles for select using (is_staff_user());

-- ---------- SEED: DISHES ----------
insert into dishes (name, category, description, price, sizes) values
-- Shawarma
('Beef Shawarma', 'shawarma', 'Grilled beef, house sauce, warm wrap.', null, '[{"label":"Small","price":3000},{"label":"Medium","price":3400},{"label":"Big","price":3800}]'),
('Chicken Shawarma', 'shawarma', 'Grilled chicken, house sauce, warm wrap.', null, '[{"label":"Small","price":3000},{"label":"Medium","price":3400},{"label":"Big","price":3800}]'),
('Coconut-Chicken Shawarma', 'shawarma', 'Chicken with a coconut twist.', null, '[{"label":"Small","price":3000},{"label":"Medium","price":3400},{"label":"Big","price":3800}]'),
-- Pizza
('Beef Pizza', 'pizza', 'Seasoned beef, mozzarella, tomato base.', null, '[{"label":"Small","price":9000},{"label":"Medium","price":10000},{"label":"Big","price":11000}]'),
('Chicken Pizza', 'pizza', 'Shredded chicken, mozzarella, tomato base.', null, '[{"label":"Small","price":9000},{"label":"Medium","price":10000},{"label":"Big","price":11000}]'),
('Coconut-Chicken Pizza', 'pizza', 'Chicken pizza with a coconut twist.', null, '[{"label":"Small","price":9000},{"label":"Medium","price":10000},{"label":"Big","price":11000}]'),
('Pepperoni Pizza', 'pizza', 'Classic pepperoni, mozzarella.', null, '[{"label":"Small","price":9000},{"label":"Medium","price":10000},{"label":"Big","price":11000}]'),
('Margherita Pizza', 'pizza', 'Basil, mozzarella, tomato base.', null, '[{"label":"Small","price":9000},{"label":"Medium","price":10000},{"label":"Big","price":11000}]'),
-- Burger
('Beef Burger', 'burger', 'Beef patty, cheese, house sauce.', null, '[{"label":"Single","price":4500},{"label":"Double","price":5500}]'),
('Chicken Burger', 'burger', 'Crispy chicken, cheese, house sauce.', null, '[{"label":"Single","price":4500},{"label":"Double","price":5500}]'),
-- Fries & sides
('Yam Fries', 'sides', 'Golden fried yam sticks.', 1000, null),
('French Fries', 'sides', 'Classic salted fries.', 1000, null),
('Plantain Fries', 'sides', 'Sweet fried plantain sticks.', 1000, null),
-- Milkshakes
('Strawberry Milkshake', 'milkshake', 'Blended thick and cold.', 4000, null),
('Chocolate Milkshake', 'milkshake', 'Blended thick and cold.', 4000, null),
('Banana Milkshake', 'milkshake', 'Blended thick and cold.', 4000, null),
('Coconut Milkshake', 'milkshake', 'Blended thick and cold.', 4000, null),
('Vanilla Milkshake', 'milkshake', 'Blended thick and cold.', 4000, null),
-- Ice cream
('Strawberry Ice Cream', 'dessert', 'Creamy scoop.', null, '[{"label":"Small","price":2000},{"label":"Big","price":4000}]'),
('Vanilla Ice Cream', 'dessert', 'Creamy scoop.', null, '[{"label":"Small","price":2000},{"label":"Big","price":4000}]'),
('Mixed Ice Cream', 'dessert', 'Creamy scoop.', null, '[{"label":"Small","price":2000},{"label":"Big","price":4000}]'),
-- Snacks
('Meat Pie', 'snacks', 'Flaky pastry, seasoned filling.', 1500, null),
('Doughnut', 'snacks', 'Soft and sweet.', 1000, null),
('Beefwich', 'snacks', 'Beef-filled pastry.', 2500, null),
-- Drinks
('Coke', 'drinks', 'Chilled bottle.', 700, null),
('Fanta', 'drinks', 'Chilled bottle.', 700, null),
('Sprite', 'drinks', 'Chilled bottle.', 700, null),
('Pepsi', 'drinks', 'Chilled bottle.', 700, null),
('Schweppes', 'drinks', 'Chilled bottle.', 1000, null),
('5 Alive', 'drinks', 'Fruit juice.', null, '[{"label":"Small","price":1000},{"label":"Big","price":2500}]'),
('Hollandia Yogurt', 'drinks', 'Chilled yogurt drink.', null, '[{"label":"Small","price":1000},{"label":"Big","price":2500}]'),
('Exotic Drink', 'drinks', 'Chilled fruit drink.', null, '[{"label":"Small","price":1000},{"label":"Big","price":2500}]'),
('Water', 'drinks', 'Bottled water.', 400, null),
-- Rice & spaghetti
('Jollof Rice', 'rice', 'The famous Mr. Jollof recipe.', 1300, null),
('Fried Rice', 'rice', 'Peppered, vegetable fried rice.', 1300, null),
('Jollof Spaghetti', 'rice', 'Spaghetti in smoky jollof sauce.', 1300, null),
-- Noodles
('Cooked / Stir-fried Noodles', 'noodles', 'Choose cooked or stir-fried.', 1500, null),
('Chicken Noodles', 'noodles', 'Noodles topped with chicken.', 3500, null),
('Beef Noodles', 'noodles', 'Noodles topped with beef.', 2500, null),
-- Protein & extras
('Chicken (protein add-on)', 'protein', 'Grilled chicken portion.', 2000, null),
('Wings (4 pieces)', 'protein', 'Crispy chicken wings.', 2000, null),
('Beef (protein add-on)', 'protein', 'Seasoned beef portion.', 1000, null),
('Plantain (extra)', 'protein', 'Side of fried plantain.', 1000, null),
('Coleslaw (extra)', 'protein', 'Fresh, creamy coleslaw.', 1000, null);

-- ---------- SEED: DEALS ----------
insert into deals (id, name, items, was, price, save, badge, note) values
('d1', 'Breakfast Budget', 'Tea/Coffee + Toasted Bread', 2500, 2000, 500, '20% OFF', 'Everyday, 7:30am – 11am'),
('d2', 'Breakfast Feast', 'Meat Pie + Yogurt', 2700, 2200, 500, '18% OFF', 'Everyday, 7:30am – 11am'),
('d3', 'Breakfast Deluxe', 'Rice (alt. spaghetti) + Beef (alt. double egg) + Drink', 3500, 3000, 500, '14% OFF', 'Everyday, 7:30am – 11am'),
('d4', 'Jinja Family Combo', '4 Jollof Rice + 2 Chicken (or fish) + 2 Beef (or 4pc wings) + 2 Plantain + 2 Coleslaw + 4 Drinks + 2 Water', 18800, 15980, 2820, '15% OFF', null),
('d5', 'Jinja Combo', 'Jollof Rice (alt. spaghetti/fried) + Chicken Thigh + Plantain + Coleslaw + Drink', 6000, 5400, 600, '10% OFF', null),
('d6', 'Jinja Max', 'Shawarma + Fries + Milkshake', 8800, 7920, 880, '10% OFF', null),
('d7', 'Stay Sweet', 'Burger + Fries + Milkshake', 9500, 8075, 1425, '15% OFF', null);

-- ---------- SEED: BIRTHDAY PACKAGES ----------
insert into birthday_packages (tier, cost, voucher, perks, featured) values
('Basic', 30000, 35000, '["1 Table Reservation","Balloon table decoration","Allowed to bring in Cakes"]', false),
('Flex', 80000, 90000, '["2 Table Reservations","Balloon table decoration","Allowed to bring in Cakes","1 gift pack for celebrant"]', true),
('Experience', 150000, 165000, '["2+ Table Reservation","Balloon table decoration","Allowed to bring in Cakes","1 gift pack for celebrant","Free photoshoot"]', false);

-- ============================================================
-- ALREADY HAVE A LIVE DATABASE? Don't re-run this whole file —
-- it would drop and recreate every table, wiping your real orders
-- and staff account. This block is safe to run as many times as
-- you need — every piece checks for existing state first:
--
--   alter table dishes add column if not exists image_url text;
--   alter table deals add column if not exists image_url text;
--   alter table profiles add column if not exists email text;
--
--   create or replace function public.is_staff_user()
--   returns boolean language sql security definer set search_path = public stable
--   as $$ select coalesce((select is_staff from profiles where id = auth.uid()), false); $$;
--
--   drop policy if exists "Staff insert dishes" on dishes;
--   create policy "Staff insert dishes" on dishes for insert with check (is_staff_user());
--   drop policy if exists "Staff delete dishes" on dishes;
--   create policy "Staff delete dishes" on dishes for delete using (is_staff_user());
--   drop policy if exists "Staff update dishes" on dishes;
--   create policy "Staff update dishes" on dishes for update using (is_staff_user());
--   drop policy if exists "Staff read all profiles" on profiles;
--   create policy "Staff read all profiles" on profiles for select using (is_staff_user());
--   drop policy if exists "Staff delete orders" on orders;
--   create policy "Staff delete orders" on orders for delete using (is_staff_user());
--   drop policy if exists "Staff update orders" on orders;
--   create policy "Staff update orders" on orders for update using (is_staff_user());
--   drop policy if exists "Users read own orders" on orders;
--   create policy "Users read own orders" on orders for select using (
--     auth.uid() = user_id or is_staff_user()
--   );
--   drop policy if exists "Guest orders are readable" on orders;
--   create policy "Guest orders are readable" on orders for select using (user_id is null);
--
-- ============================================================

-- ============================================================
-- MAKING SOMEONE STAFF (do this after they've signed up once
-- through the website, so their profiles row exists):
--
--   update profiles set is_staff = true where id =
--     (select id from auth.users where email = 'staff@example.com');
--
-- They can then log in at admin.html.
-- ============================================================

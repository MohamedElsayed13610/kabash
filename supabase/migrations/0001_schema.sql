-- KABASH schema. Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type category_type   as enum ('restaurant', 'butcher');
create type item_unit       as enum ('piece', 'kg');
create type discount_type   as enum ('percent', 'fixed');
create type offer_target    as enum ('item', 'category', 'cart');
create type fulfillment     as enum ('delivery', 'pickup');
create type payment_method  as enum ('cash');            -- extend later: alter type payment_method add value 'card'
create type order_status    as enum ('new', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
create type staff_role      as enum ('owner', 'manager', 'cashier');

-- ---------- staff ----------
create table profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       staff_role not null default 'cashier',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Role of the current user, or null if not active staff. SECURITY DEFINER avoids RLS recursion.
create function staff_role() returns staff_role
language sql stable security definer set search_path = public as $$
  select role from profiles where user_id = auth.uid() and active
$$;

create function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select staff_role() is not null
$$;

create function can_manage_menu() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(staff_role() in ('owner', 'manager'), false)
$$;

-- ---------- menu ----------
create table categories (
  id        uuid primary key default gen_random_uuid(),
  type      category_type not null,
  name_ar   text not null,
  sort      int not null default 0,
  active    boolean not null default true,
  is_sample boolean not null default false
);

create table items (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references categories(id) on delete cascade,
  name_ar        text not null,
  description_ar text,
  unit           item_unit not null default 'piece',
  base_price     numeric(10,2) not null check (base_price >= 0),  -- per piece, or per kg
  min_qty        numeric(8,3) not null default 1 check (min_qty > 0),
  step_qty       numeric(8,3) not null default 1 check (step_qty > 0),
  serving_tag    text,                                            -- e.g. "تكفي ٤ أفراد"
  image_url      text,
  active         boolean not null default true,                   -- visible on the site
  available      boolean not null default true,                   -- false = out of stock
  featured       boolean not null default false,
  sort           int not null default 0,
  is_sample      boolean not null default false
);
create index on items (category_id, sort);

create table item_variants (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references items(id) on delete cascade,
  name_ar     text not null,
  price_delta numeric(10,2) not null default 0,
  sort        int not null default 0
);
create index on item_variants (item_id);

create table item_extras (
  id      uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  name_ar text not null,
  price   numeric(10,2) not null default 0 check (price >= 0),
  sort    int not null default 0
);
create index on item_extras (item_id);

-- ---------- offers ----------
create table offers (
  id             uuid primary key default gen_random_uuid(),
  title_ar       text not null,
  description_ar text,
  image_url      text,
  discount_type  discount_type not null,
  discount_value numeric(10,2) not null check (discount_value > 0),
  target_type    offer_target not null default 'cart',
  target_id      uuid,                       -- item id or category id; null for cart
  starts_at      timestamptz,
  ends_at        timestamptz,
  active         boolean not null default true,
  is_sample      boolean not null default false,
  check (target_type = 'cart' or target_id is not null)
);

-- ---------- delivery zones (fully admin-managed) ----------
create table delivery_zones (
  id          uuid primary key default gen_random_uuid(),
  name_ar     text not null,
  fee         numeric(10,2) not null default 0 check (fee >= 0),
  min_order   numeric(10,2) not null default 0 check (min_order >= 0),
  eta_minutes int,
  sort        int not null default 0,
  active      boolean not null default true,
  is_sample   boolean not null default false
);

-- ---------- settings ----------
create table settings (
  key       text primary key,
  value     jsonb not null,
  is_public boolean not null default true      -- false = staff-only
);

-- ---------- orders ----------
create table orders (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,                 -- short public tracking code
  customer_name     text not null,
  phone             text not null check (phone ~ '^01[0125][0-9]{8}$'),
  fulfillment       fulfillment not null,
  zone_id           uuid references delivery_zones(id) on delete set null,
  zone_name         text,                                 -- snapshot
  address_json      jsonb,
  notes             text,
  payment_method    payment_method not null default 'cash',
  has_butcher       boolean not null default false,       -- board filters
  has_restaurant    boolean not null default false,
  subtotal_estimate numeric(10,2) not null,
  delivery_fee      numeric(10,2) not null default 0,     -- snapshot
  discount_total    numeric(10,2) not null default 0,
  total_estimate    numeric(10,2) not null,
  total_final       numeric(10,2),                        -- set after weighing
  status            order_status not null default 'new',
  cancel_reason     text,
  acknowledged_at   timestamptz,                          -- stops the alert sound
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on orders (status, created_at desc);
create index on orders (created_at desc);

create table order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  item_id             uuid references items(id) on delete set null,
  kind                category_type not null,
  name_snapshot       text not null,
  unit                item_unit not null,
  qty_requested       numeric(8,3) not null check (qty_requested > 0),
  qty_final           numeric(8,3),
  unit_price_snapshot numeric(10,2) not null,             -- base + variant + extras, per unit
  variant_snapshot    jsonb,                              -- {variant, extras[]}
  line_total_estimate numeric(10,2) not null,
  line_total_final    numeric(10,2)
);
create index on order_items (order_id);

create table order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  status     order_status not null,
  by_user    uuid references auth.users(id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);
create index on order_events (order_id, created_at);

-- ---------- rate limiting (server only) ----------
create table rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         int not null default 0
);

-- Returns true if the call is allowed. Callable by the service role only.
create function rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare r rate_limits;
begin
  insert into rate_limits(key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                then 1 else rate_limits.hits + 1 end,
    window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                then now() else rate_limits.window_start end
  returning * into r;
  return r.hits <= p_max;
end $$;
revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;

-- ---------- keep updated_at fresh ----------
create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger orders_touch before update on orders for each row execute function touch_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table profiles       enable row level security;
alter table categories     enable row level security;
alter table items          enable row level security;
alter table item_variants  enable row level security;
alter table item_extras    enable row level security;
alter table offers         enable row level security;
alter table delivery_zones enable row level security;
alter table settings       enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table order_events   enable row level security;
alter table rate_limits    enable row level security;   -- no policies: service role only

-- profiles
create policy profiles_self_read on profiles for select using (user_id = auth.uid() or staff_role() = 'owner');
create policy profiles_owner_all on profiles for all    using (staff_role() = 'owner') with check (staff_role() = 'owner');

-- public menu data (read), owner/manager (write)
create policy categories_public on categories for select using (active or can_manage_menu());
create policy categories_write  on categories for all    using (can_manage_menu()) with check (can_manage_menu());

create policy items_public on items for select
  using ((active and exists (select 1 from categories c where c.id = category_id and c.active)) or can_manage_menu());
create policy items_write on items for all using (can_manage_menu()) with check (can_manage_menu());

create policy variants_public on item_variants for select
  using (exists (select 1 from items i join categories c on c.id = i.category_id
                 where i.id = item_id and i.active and c.active) or can_manage_menu());
create policy variants_write on item_variants for all using (can_manage_menu()) with check (can_manage_menu());

create policy extras_public on item_extras for select
  using (exists (select 1 from items i join categories c on c.id = i.category_id
                 where i.id = item_id and i.active and c.active) or can_manage_menu());
create policy extras_write on item_extras for all using (can_manage_menu()) with check (can_manage_menu());

create policy offers_public on offers for select
  using ((active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()))
         or can_manage_menu());
create policy offers_write on offers for all using (can_manage_menu()) with check (can_manage_menu());

create policy zones_public on delivery_zones for select using (active or can_manage_menu());
create policy zones_write  on delivery_zones for all using (can_manage_menu()) with check (can_manage_menu());

-- settings: public keys readable by all; only the owner writes
create policy settings_public on settings for select using (is_public or is_staff());
create policy settings_owner  on settings for all    using (staff_role() = 'owner') with check (staff_role() = 'owner');

-- orders: NO public access at all. Customers create/track through server routes (service role).
create policy orders_staff_read   on orders for select using (is_staff());
create policy orders_staff_update on orders for update using (is_staff()) with check (is_staff());

create policy order_items_staff_read   on order_items for select using (is_staff());
create policy order_items_staff_update on order_items for update using (is_staff()) with check (is_staff());

create policy order_events_staff_read   on order_events for select using (is_staff());
create policy order_events_staff_insert on order_events for insert with check (is_staff() and by_user = auth.uid());

-- realtime for the live orders board
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;

-- =====================================================================
-- STORAGE: public bucket for item photos and offer banners
-- =====================================================================
insert into storage.buckets (id, name, public) values ('menu', 'menu', true) on conflict do nothing;

create policy menu_media_read   on storage.objects for select using (bucket_id = 'menu');
create policy menu_media_insert on storage.objects for insert with check (bucket_id = 'menu' and can_manage_menu());
create policy menu_media_update on storage.objects for update using (bucket_id = 'menu' and can_manage_menu());
create policy menu_media_delete on storage.objects for delete using (bucket_id = 'menu' and can_manage_menu());

-- Web Push subscriptions for staff devices + who acknowledged an order.
-- Run in the Supabase SQL editor after 0001 and 0002. Safe to run more than once.

create table if not exists push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  endpoint        text not null unique,          -- one row per browser/device
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  failures        int not null default 0,        -- consecutive failed sends; dead ones are purged
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Staff can see and remove their own devices. Inserts/updates happen only on the server (service role),
-- after the server has verified the caller is active staff.
drop policy if exists push_own_read   on push_subscriptions;
drop policy if exists push_own_delete on push_subscriptions;
create policy push_own_read   on push_subscriptions for select using (user_id = auth.uid());
create policy push_own_delete on push_subscriptions for delete using (user_id = auth.uid());

alter table orders add column if not exists acknowledged_by uuid references auth.users(id) on delete set null;

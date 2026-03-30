-- =============================================================================
-- BRÜ COINS — Database Schema
-- Run this in your Supabase SQL Editor (or via supabase db push)
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================================================
-- TABLES
-- =============================================================================

-- baristas: the BRÜ team members
create table if not exists baristas (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  avatar_url       text,
  pin              text,                              -- bcrypt-hashed 4-digit PIN
  coin_balance     integer not null default 0 check (coin_balance >= 0),
  total_coins_earned integer not null default 0,      -- all-time earned, never decremented
  total_redeemed   integer not null default 0,        -- count of successful redemptions
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- rewards: the catalog of things baristas can redeem
create table if not exists rewards (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  description  text,
  image_url    text,
  price        integer not null check (price > 0),
  is_available boolean not null default true,
  created_at   timestamptz not null default now()
);

-- transactions: every coin movement
create table if not exists transactions (
  id          uuid primary key default uuid_generate_v4(),
  barista_id  uuid not null references baristas(id) on delete cascade,
  type        text not null check (type in ('earn', 'deduct')),
  amount      integer not null check (amount > 0),   -- always positive; type determines direction
  reason      text not null,
  created_by  text not null default 'admin',          -- 'admin' or 'system'
  created_at  timestamptz not null default now()
);

-- redemptions: when a barista cashes in a reward
create table if not exists redemptions (
  id          uuid primary key default uuid_generate_v4(),
  barista_id  uuid not null references baristas(id) on delete cascade,
  reward_id   uuid not null references rewards(id),
  coins_spent integer not null,
  redeemed_at timestamptz not null default now(),
  notified    boolean not null default false
);

-- admins: maps Supabase Auth users to admin role
create table if not exists admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- app_settings: key-value store for runtime configuration
create table if not exists app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists idx_transactions_barista_id on transactions(barista_id);
create index if not exists idx_transactions_created_at on transactions(created_at desc);
create index if not exists idx_redemptions_barista_id  on redemptions(barista_id);
create index if not exists idx_redemptions_notified    on redemptions(notified) where notified = false;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table baristas     enable row level security;
alter table rewards      enable row level security;
alter table transactions enable row level security;
alter table redemptions  enable row level security;
alter table admins       enable row level security;
alter table app_settings enable row level security;

-- Helper: check if the current Supabase Auth user is an admin
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from admins where id = auth.uid()
  );
$$;

-- ── baristas ──────────────────────────────────────────────────────────────────
-- Public can read active baristas (needed for leaderboard + redemption flow)
create policy "Public read active baristas" on baristas
  for select using (is_active = true);

-- Admins have full access (for management panel)
create policy "Admins manage baristas" on baristas
  for all using (is_admin());

-- ── rewards ───────────────────────────────────────────────────────────────────
-- Public can read all rewards (for marketplace display)
create policy "Public read rewards" on rewards
  for select using (true);

-- Admins have full access
create policy "Admins manage rewards" on rewards
  for all using (is_admin());

-- ── transactions ─────────────────────────────────────────────────────────────
-- Public can read transactions (for the activity feed)
create policy "Public read transactions" on transactions
  for select using (true);

-- Admins have full access
create policy "Admins manage transactions" on transactions
  for all using (is_admin());

-- ── redemptions ───────────────────────────────────────────────────────────────
-- Admins can read all redemptions
create policy "Admins read redemptions" on redemptions
  for select using (is_admin());

-- Admins can update (mark notified)
create policy "Admins update redemptions" on redemptions
  for update using (is_admin());

-- ── admins ────────────────────────────────────────────────────────────────────
-- Admins can read the admin list (to show it in settings)
create policy "Admins read admin list" on admins
  for select using (is_admin());

-- ── app_settings ──────────────────────────────────────────────────────────────
-- Admins have full access to settings
create policy "Admins manage settings" on app_settings
  for all using (is_admin());

-- =============================================================================
-- STORED PROCEDURES (called from Server Actions via .rpc())
-- These run as security definer to bypass RLS for atomic coin operations
-- =============================================================================

-- add_coins: atomically credit a barista and log the transaction
create or replace function add_coins(
  p_barista_id uuid,
  p_amount     integer,
  p_reason     text
)
returns void
language plpgsql
security definer
as $$
begin
  -- Update balances
  update baristas
  set
    coin_balance       = coin_balance + p_amount,
    total_coins_earned = total_coins_earned + p_amount
  where id = p_barista_id;

  -- Log transaction
  insert into transactions (barista_id, type, amount, reason, created_by)
  values (p_barista_id, 'earn', p_amount, p_reason, 'admin');
end;
$$;

-- deduct_coins: atomically debit a barista and log the transaction
create or replace function deduct_coins(
  p_barista_id uuid,
  p_amount     integer,
  p_reason     text
)
returns void
language plpgsql
security definer
as $$
declare
  v_balance integer;
begin
  select coin_balance into v_balance from baristas where id = p_barista_id for update;

  if v_balance < p_amount then
    raise exception 'Saldo insuficiente: tiene %, necesita %', v_balance, p_amount;
  end if;

  update baristas
  set coin_balance = coin_balance - p_amount
  where id = p_barista_id;

  insert into transactions (barista_id, type, amount, reason, created_by)
  values (p_barista_id, 'deduct', p_amount, p_reason, 'admin');
end;
$$;

-- redeem_reward: atomically redeem a reward and return new balance
create or replace function redeem_reward(
  p_barista_id  uuid,
  p_reward_id   uuid,
  p_coins       integer,
  p_reward_name text
)
returns integer
language plpgsql
security definer
as $$
declare
  v_balance    integer;
  v_new_balance integer;
begin
  -- Lock the barista row for update
  select coin_balance into v_balance
  from baristas
  where id = p_barista_id and is_active = true
  for update;

  if not found then
    raise exception 'Barista no encontrado o inactivo';
  end if;

  if v_balance < p_coins then
    raise exception 'Saldo insuficiente: tiene ₿%, necesita ₿%', v_balance, p_coins;
  end if;

  -- Deduct coins and increment redemption counter
  update baristas
  set
    coin_balance   = coin_balance - p_coins,
    total_redeemed = total_redeemed + 1
  where id = p_barista_id
  returning coin_balance into v_new_balance;

  -- Log transaction
  insert into transactions (barista_id, type, amount, reason, created_by)
  values (p_barista_id, 'deduct', p_coins, 'Canje: ' || p_reward_name, 'system');

  -- Log redemption
  insert into redemptions (barista_id, reward_id, coins_spent)
  values (p_barista_id, p_reward_id, p_coins);

  return v_new_balance;
end;
$$;

-- =============================================================================
-- SUPABASE STORAGE BUCKETS
-- Run these in the Supabase dashboard Storage section, or via the API
-- =============================================================================

-- Create the storage bucket (run manually in Supabase Dashboard → Storage)
-- Bucket name: bru-assets
-- Public: true
-- Allowed MIME types: image/*
-- Max file size: 5MB

-- Or via SQL (requires Supabase Storage extension):
-- insert into storage.buckets (id, name, public)
-- values ('bru-assets', 'bru-assets', true)
-- on conflict do nothing;

-- Storage policies (run after creating the bucket):
-- create policy "Public read bru-assets" on storage.objects
--   for select using (bucket_id = 'bru-assets');
--
-- create policy "Admins upload bru-assets" on storage.objects
--   for insert with check (bucket_id = 'bru-assets');
--
-- create policy "Admins update bru-assets" on storage.objects
--   for update using (bucket_id = 'bru-assets');

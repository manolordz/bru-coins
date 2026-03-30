-- =============================================================================
-- BRÜ COINS — Migration 002: coin_rules and coin_requests
-- =============================================================================

-- ─── coin_rules ──────────────────────────────────────────────────────────────

create table if not exists coin_rules (
  id          uuid primary key default uuid_generate_v4(),
  type        text not null check (type in ('earn', 'deduct')),
  description text not null,
  amount      integer not null default 0 check (amount >= 0),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table coin_rules enable row level security;

-- Public (anon) reads only active rules — used by the home page
create policy "anon_read_active_coin_rules" on coin_rules
  for select to anon using (is_active = true);

-- Authenticated admins read all rules (including inactive) for admin panel
create policy "auth_read_all_coin_rules" on coin_rules
  for select to authenticated using (true);

-- ─── coin_requests ───────────────────────────────────────────────────────────

create table if not exists coin_requests (
  id           uuid primary key default uuid_generate_v4(),
  barista_id   uuid not null references baristas(id) on delete cascade,
  items        jsonb not null default '[]'::jsonb,
  total_amount integer not null default 0 check (total_amount >= 0),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references admins(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table coin_requests enable row level security;

-- Authenticated admins can read all requests
create policy "auth_read_all_coin_requests" on coin_requests
  for select to authenticated using (true);

-- ─── Seed default earn/deduct rules ──────────────────────────────────────────

insert into coin_rules (type, description, amount, sort_order) values
  ('earn', 'Tarjeta de sellos',        1,   1),
  ('earn', 'Corte de caja perfecto',   2,   2),
  ('earn', 'Shoutout / mención',       2,   3),
  ('earn', 'Proponer idea útil',       2,   4),
  ('earn', 'Grano de plata',           2,   5),
  ('earn', 'Grano de oro',             5,   6),
  ('earn', '0 faltas en el mes',       5,   7),
  ('earn', 'Review positivo',          5,   8),
  ('earn', 'Puntualidad impecable',    5,   9),
  ('earn', 'Cubrir turno emergencia',  10,  10),
  ('deduct', 'No usar mandil',         1,   1),
  ('deduct', 'No marcar bebidas',      1,   2),
  ('deduct', 'Llegada tarde',          2,   3),
  ('deduct', 'No check-in/out',        2,   4),
  ('deduct', 'Olvidar órdenes',        5,   5),
  ('deduct', 'No enviar checklist',    5,   6),
  ('deduct', 'Falta sin avisar',       10,  7),
  ('deduct', 'Otras sanciones',        0,   8)
on conflict do nothing;

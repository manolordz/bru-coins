-- =============================================================================
-- BRÜ COINS — Migration 003: proposals
-- Run this in the Supabase SQL editor
-- =============================================================================

create table if not exists proposals (
  id           uuid primary key default uuid_generate_v4(),
  barista_id   uuid not null references baristas(id) on delete cascade,
  idea_type    text not null check (idea_type in ('nueva_recompensa', 'idea_mejora', 'otro')),
  message      text not null,
  status       text not null default 'pending' check (status in ('pending', 'reviewed')),
  admin_notes  text,
  created_at   timestamptz not null default now()
);

alter table proposals enable row level security;

-- Service role handles all writes (submits + admin updates)
-- Authenticated admins can read and update all proposals
create policy "auth_read_proposals" on proposals
  for select to authenticated using (true);

create policy "auth_update_proposals" on proposals
  for update to authenticated using (true);

-- Index for fast pending count queries (used by sidebar badge)
create index if not exists proposals_status_idx on proposals(status);
create index if not exists proposals_barista_idx on proposals(barista_id);

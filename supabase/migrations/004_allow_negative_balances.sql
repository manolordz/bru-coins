-- =============================================================================
-- BRÜ COINS — Migration 004: allow negative coin balances
-- Run this in the Supabase SQL editor
-- =============================================================================

-- 1. Drop the column-level CHECK constraint (may already be gone, safe to re-run)
alter table baristas drop constraint if exists baristas_coin_balance_check;

-- 2. Replace deduct_coins — remove the balance guard so admins can push
--    a barista into negative territory as a penalty.
--    (redeem_reward keeps its own guard; baristas can never redeem into negative.)
create or replace function deduct_coins(
  p_barista_id uuid,
  p_amount     integer,
  p_reason     text
)
returns void
language plpgsql
security definer
as $$
begin
  -- Lock the row for the atomic update (no balance check — negatives allowed)
  perform 1 from baristas where id = p_barista_id for update;

  update baristas
  set coin_balance = coin_balance - p_amount
  where id = p_barista_id;

  insert into transactions (barista_id, type, amount, reason, created_by)
  values (p_barista_id, 'deduct', p_amount, p_reason, 'admin');
end;
$$;

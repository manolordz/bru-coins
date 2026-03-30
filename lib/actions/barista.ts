'use server'

import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { sendRedemptionEmail } from '@/lib/notifications'

export type BaristaVerifyResult =
  | { success: true; barista: { id: string; name: string; avatar_url: string | null; coin_balance: number } }
  | { success: false; error: string; locked?: boolean; lockUntil?: number }

// Verify a barista's 4-digit PIN
export async function verifyBaristaPin(
  baristaId: string,
  pin: string
): Promise<BaristaVerifyResult> {
  if (!/^\d{4}$/.test(pin)) {
    return { success: false, error: 'El PIN debe ser de 4 dígitos numéricos.' }
  }

  const supabase = createServiceClient()

  const { data: barista, error } = await supabase
    .from('baristas')
    .select('id, name, avatar_url, coin_balance, pin, is_active')
    .eq('id', baristaId)
    .eq('is_active', true)
    .single()

  if (error || !barista) {
    return { success: false, error: 'Barista no encontrado.' }
  }

  if (!barista.pin) {
    return { success: false, error: 'Este barista no tiene PIN configurado. Contacta al administrador.' }
  }

  const isValid = await bcrypt.compare(pin, barista.pin)

  if (!isValid) {
    return { success: false, error: 'PIN incorrecto. Inténtalo de nuevo.' }
  }

  return {
    success: true,
    barista: {
      id: barista.id,
      name: barista.name,
      avatar_url: barista.avatar_url,
      coin_balance: barista.coin_balance,
    },
  }
}

export type RedeemResult =
  | { success: true; newBalance: number; rewardName: string }
  | { success: false; error: string }

// Redeem a reward — deducts coins, records transaction and redemption
export async function redeemReward(
  baristaId: string,
  rewardId: string
): Promise<RedeemResult> {
  const supabase = createServiceClient()

  // Fetch barista and reward atomically
  const [{ data: barista }, { data: reward }] = await Promise.all([
    supabase
      .from('baristas')
      .select('id, name, coin_balance, is_active')
      .eq('id', baristaId)
      .single(),
    supabase
      .from('rewards')
      .select('id, name, price, is_available')
      .eq('id', rewardId)
      .single(),
  ])

  if (!barista || !barista.is_active) {
    return { success: false, error: 'Barista no encontrado o inactivo.' }
  }

  if (!reward || !reward.is_available) {
    return { success: false, error: 'Recompensa no disponible.' }
  }

  if (barista.coin_balance < reward.price) {
    return {
      success: false,
      error: `Saldo insuficiente. Necesitas ₿${reward.price} pero tienes ₿${barista.coin_balance}.`,
    }
  }

  // Use the database function for atomic deduction
  const { data, error } = await supabase.rpc('redeem_reward', {
    p_barista_id: baristaId,
    p_reward_id: rewardId,
    p_coins: reward.price,
    p_reward_name: reward.name,
  })

  if (error) {
    console.error('Error al canjear recompensa:', error)
    return { success: false, error: 'Error al procesar el canje. Inténtalo de nuevo.' }
  }

  const newBalance: number = data

  // Await the email before returning — do NOT fire-and-forget.
  // Vercel serverless functions terminate the instant the Server Action
  // returns a response; any unawaited async work is silently killed.
  try {
    const { data: redemption } = await supabase
      .from('redemptions')
      .select('id, redeemed_at')
      .eq('barista_id', baristaId)
      .eq('reward_id', rewardId)
      .eq('notified', false)
      .order('redeemed_at', { ascending: false })
      .limit(1)
      .single()

    if (redemption) {
      await sendRedemptionEmail({
        redemptionId: redemption.id,
        baristaName: barista.name,
        rewardName: reward.name,
        coinsSpent: reward.price,
        newBalance,
        redeemedAt: redemption.redeemed_at,
      })
    }
  } catch (notifyErr) {
    // Non-fatal — the redemption already succeeded, email is best-effort
    console.error('[notify] Error enviando email de canje:', notifyErr)
  }

  return {
    success: true,
    newBalance,
    rewardName: reward.name,
  }
}

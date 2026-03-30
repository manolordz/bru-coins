import { NextRequest, NextResponse } from 'next/server'
import { sendRedemptionEmail } from '@/lib/notifications'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/notify
 *
 * Accepts either:
 *  (a) A Supabase Database Webhook payload  { type: 'INSERT', record: { id, barista_id, reward_id, ... } }
 *  (b) A direct call with the full RedemptionEmailData shape
 *
 * Protected by CRON_SECRET or SUPABASE_WEBHOOK_SECRET to prevent abuse.
 */
export async function POST(req: NextRequest) {
  // Optional: verify a shared secret header
  const secret = process.env.NOTIFY_SECRET || process.env.SUPABASE_WEBHOOK_SECRET || ''
  if (secret) {
    const authHeader = req.headers.get('authorization') || ''
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Handle Supabase webhook format: { type: 'INSERT', table: 'redemptions', record: {...} }
  const isWebhook = body.type === 'INSERT' && body.table === 'redemptions' && body.record
  const record = isWebhook
    ? (body.record as Record<string, unknown>)
    : null

  if (isWebhook && record) {
    // Webhook path — resolve barista name and reward name from their IDs
    const supabase = createServiceClient()

    const [{ data: barista }, { data: reward }] = await Promise.all([
      supabase
        .from('baristas')
        .select('name, coin_balance')
        .eq('id', record.barista_id)
        .single(),
      supabase
        .from('rewards')
        .select('name')
        .eq('id', record.reward_id)
        .single(),
    ])

    if (!barista || !reward) {
      return NextResponse.json({ error: 'Barista or reward not found' }, { status: 404 })
    }

    await sendRedemptionEmail({
      redemptionId: record.id as string,
      baristaName: barista.name,
      rewardName: reward.name,
      coinsSpent: record.coins_spent as number,
      newBalance: barista.coin_balance,
      redeemedAt: record.redeemed_at as string ?? new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  }

  // Direct call path — expect full RedemptionEmailData in the body
  const { redemptionId, baristaName, rewardName, coinsSpent, newBalance, redeemedAt } = body as Record<string, unknown>

  if (!redemptionId || !baristaName || !rewardName || coinsSpent == null || newBalance == null) {
    return NextResponse.json(
      { error: 'Missing required fields: redemptionId, baristaName, rewardName, coinsSpent, newBalance' },
      { status: 400 }
    )
  }

  await sendRedemptionEmail({
    redemptionId: redemptionId as string,
    baristaName: baristaName as string,
    rewardName: rewardName as string,
    coinsSpent: coinsSpent as number,
    newBalance: newBalance as number,
    redeemedAt: (redeemedAt as string) ?? new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}

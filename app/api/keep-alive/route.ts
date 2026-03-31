import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/keep-alive
 *
 * Lightweight Supabase ping to prevent the free-tier project from being paused.
 * Runs on a Vercel Cron Job every 6 days (see vercel.json).
 *
 * Protected by CRON_SECRET — Vercel sets Authorization: Bearer <secret>
 * automatically for cron invocations when CRON_SECRET is set in project env vars.
 */
export async function GET(req: NextRequest) {
  // Verify the request comes from Vercel's cron scheduler (or a trusted caller)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = createServiceClient()

    // Minimal read — just fetch one row from a small table to register activity
    const { error } = await supabase
      .from('app_settings')
      .select('key')
      .limit(1)

    if (error) {
      console.error('[keep-alive] Supabase query error:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    console.log('[keep-alive] ✅ Supabase ping successful at', new Date().toISOString())
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[keep-alive] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}

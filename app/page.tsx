import { createClient } from '@/lib/supabase/server'
import { LeaderboardSection } from '@/components/leaderboard/LeaderboardSection'
import { MarketplaceSection } from '@/components/marketplace/MarketplaceSection'

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: baristas }, { data: rewards }, { data: transactions }, { data: coinRules }] = await Promise.all([
    supabase
      .from('baristas')
      .select('id, name, avatar_url, coin_balance, total_coins_earned, total_redeemed')
      .eq('is_active', true)
      .order('coin_balance', { ascending: false }),
    supabase
      .from('rewards')
      .select('id, name, description, image_url, price, is_available')
      .order('price', { ascending: true }),
    supabase
      .from('transactions')
      .select('id, barista_id, type, amount, reason, created_at, baristas(name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('coin_rules')
      .select('id, type, description, amount')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  const earnRules = (coinRules || []).filter((r: { type: string }) => r.type === 'earn')
  const deductRules = (coinRules || []).filter((r: { type: string }) => r.type === 'deduct')

  return (
    <main className="min-h-screen bg-bru-parchment flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-bru-parchment/95 backdrop-blur-sm border-b border-bru-light-gray px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">☕</span>
          <span className="font-display font-semibold text-bru-black text-base tracking-tight">BRÜ Coins</span>
        </div>
        <a
          href="/admin/login"
          className="text-xs text-bru-warm-gray hover:text-bru-orange transition-colors px-3 py-1.5 rounded-lg hover:bg-white"
        >
          Admin →
        </a>
      </header>

      {/* Body: stacked on mobile, side-by-side on desktop */}
      <div className="flex flex-col sm:flex-row flex-1 min-h-0">

        {/* ── Leaderboard ── mobile: compact strip (≤25vh) / desktop: 20% sidebar */}
        <aside className="
          sm:w-[22%] sm:min-w-[200px] sm:max-w-[260px]
          sm:border-r sm:border-bru-light-gray
          sm:overflow-y-auto sm:flex-shrink-0
          flex-shrink-0
        ">
          <LeaderboardSection
            initialBaristas={baristas || []}
            initialTransactions={(transactions as any) || []}
            earnRules={earnRules}
            deductRules={deductRules}
          />
        </aside>

        {/* ── Marketplace ── fills 80% on desktop, full width on mobile */}
        <div className="flex-1 sm:overflow-y-auto min-w-0">
          <MarketplaceSection
            rewards={rewards || []}
            baristas={baristas || []}
            earnRules={earnRules}
          />
        </div>

      </div>
    </main>
  )
}

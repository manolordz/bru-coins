'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Barista {
  id: string
  name: string
  avatar_url: string | null
  coin_balance: number
  total_coins_earned: number
  total_redeemed: number
}

interface Transaction {
  id: string
  barista_id: string
  type: 'earn' | 'deduct'
  amount: number
  reason: string
  created_at: string
  baristas?: { name: string; avatar_url: string | null }
}

interface CoinRule {
  id: string
  description: string
  amount: number
}

interface LeaderboardSectionProps {
  initialBaristas: Barista[]
  initialTransactions: Transaction[]
  earnRules?: CoinRule[]
  deductRules?: CoinRule[]
}

const RANK_LABELS = ['🥇', '🥈', '🥉']

export function LeaderboardSection({ initialBaristas, initialTransactions, earnRules = [], deductRules = [] }: LeaderboardSectionProps) {
  const [baristas, setBaristas] = useState(initialBaristas)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [showRules, setShowRules] = useState(false)
  const [showActivity, setShowActivity] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const baristaChannel = supabase
      .channel('baristas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'baristas' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setBaristas((prev) =>
            prev
              .map((b) => (b.id === payload.new.id ? { ...b, ...(payload.new as Barista) } : b))
              .sort((a, b) => b.coin_balance - a.coin_balance)
          )
        }
      })
      .subscribe()

    const txChannel = supabase
      .channel('transactions-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, async (payload) => {
        const { data: barista } = await supabase
          .from('baristas')
          .select('name, avatar_url')
          .eq('id', payload.new.barista_id)
          .single()
        setTransactions((prev) =>
          [{ ...(payload.new as Transaction), baristas: barista || undefined }, ...prev].slice(0, 10)
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(baristaChannel)
      supabase.removeChannel(txChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = [...baristas].sort((a, b) => b.coin_balance - a.coin_balance)

  return (
    <div className="flex flex-col">

      {/* ── Mobile: compact horizontal chip strip ── */}
      <div className="sm:hidden border-b border-bru-light-gray">
        {/* Header + toggles */}
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
          <span className="text-[11px] font-semibold text-bru-warm-gray uppercase tracking-widest">
            🏆 Ranking
          </span>
          <div className="flex gap-3">
            <button onClick={() => { setShowActivity(!showActivity); setShowRules(false) }}
              className={`text-[11px] font-medium transition-colors ${showActivity ? 'text-bru-orange' : 'text-bru-warm-gray hover:text-bru-orange'}`}>
              Actividad
            </button>
            <button onClick={() => { setShowRules(!showRules); setShowActivity(false) }}
              className={`text-[11px] font-medium transition-colors ${showRules ? 'text-bru-orange' : 'text-bru-warm-gray hover:text-bru-orange'}`}>
              ¿Cómo ganar?
            </button>
          </div>
        </div>

        {/* Horizontal scrollable chips — single row */}
        <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 pt-1 scrollbar-none">
          {sorted.map((b, i) => (
            <div
              key={b.id}
              className={`flex items-center gap-1.5 flex-shrink-0 rounded-full px-3 py-1.5 border text-sm ${
                i === 0
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-white/80 border-bru-light-gray'
              }`}
            >
              <span className="text-base leading-none">{i < 3 ? RANK_LABELS[i] : `#${i + 1}`}</span>
              <Avatar name={b.name} avatarUrl={b.avatar_url} size="sm"
                className="!w-5 !h-5 text-[9px]" />
              <span className="font-medium text-bru-black">{b.name}</span>
              <span className={`font-display font-bold ${b.coin_balance < 0 ? 'text-red-500' : 'text-bru-orange'}`}>
                {b.coin_balance < 0 ? `-₿${Math.abs(b.coin_balance)}` : `₿${b.coin_balance}`}
              </span>
            </div>
          ))}
        </div>

        {/* Collapsible: Activity */}
        {showActivity && transactions.length > 0 && (
          <div className="mx-3 mb-2 bg-white/70 rounded-xl px-3 py-2 space-y-1.5 max-h-[22vh] overflow-y-auto border border-bru-light-gray">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-baseline gap-2">
                <span className={`text-xs font-bold flex-shrink-0 ${tx.type === 'earn' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'earn' ? '+' : '−'}₿{tx.amount}
                </span>
                <p className="text-xs text-bru-black leading-snug">
                  <span className="font-medium">{tx.baristas?.name}</span>
                  {' — '}{tx.reason}
                  <span className="text-bru-warm-gray text-[10px] ml-1">
                    · {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: es })}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Collapsible: Rules */}
        {showRules && (
          <div className="mx-3 mb-2 bg-white/70 rounded-xl px-3 py-2 text-xs max-h-[30vh] overflow-y-auto border border-bru-light-gray space-y-2">
            {earnRules.length > 0 && (
              <div>
                <p className="font-semibold text-green-700 mb-1">✅ Ganar ₿</p>
                {earnRules.map((r) => (
                  <div key={r.id} className="flex justify-between py-0.5 border-b border-bru-light-gray/40 last:border-0">
                    <span className="text-bru-black">{r.description}</span>
                    <span className="text-green-600 font-semibold ml-3 flex-shrink-0">
                      {r.amount > 0 ? `+₿${r.amount}` : '+₿?'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {deductRules.length > 0 && (
              <div>
                <p className="font-semibold text-red-700 mb-1">❌ Perder ₿</p>
                {deductRules.map((r) => (
                  <div key={r.id} className="flex justify-between py-0.5 border-b border-bru-light-gray/40 last:border-0">
                    <span className="text-bru-black">{r.description}</span>
                    <span className="text-red-600 font-semibold ml-3 flex-shrink-0">
                      {r.amount > 0 ? `−₿${r.amount}` : '−₿?'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop: full sidebar ── */}
      <div className="hidden sm:flex md:flex-col md:h-full md:p-0">
        {/* Sidebar header */}
        <div className="px-4 pt-5 pb-3 border-b border-bru-light-gray">
          <h2 className="font-display text-lg font-bold text-bru-black">🏆 Ranking</h2>
          <p className="text-xs text-bru-warm-gray mt-0.5">Temporada actual</p>
        </div>

        {/* Barista list */}
        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
          {sorted.map((b, i) => (
            <div
              key={b.id}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors ${
                i === 0 ? 'bg-yellow-50 border border-yellow-100' : 'hover:bg-white/60'
              }`}
            >
              {/* Rank */}
              <span className="w-5 text-center flex-shrink-0 text-sm">
                {i < 3 ? RANK_LABELS[i] : <span className="text-xs text-bru-warm-gray">#{i + 1}</span>}
              </span>
              {/* Avatar */}
              <Avatar name={b.name} avatarUrl={b.avatar_url} size="sm" />
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-bru-black truncate leading-tight">{b.name}</p>
                <p className="text-[10px] text-bru-warm-gray leading-tight">
                  ₿{b.total_coins_earned} ganadas
                </p>
              </div>
              {/* Balance */}
              <div className="text-right flex-shrink-0">
                <p className={`font-display text-base font-bold leading-tight ${b.coin_balance < 0 ? 'text-red-500' : 'text-bru-orange'}`}>
                  {b.coin_balance < 0 ? `-₿${Math.abs(b.coin_balance)}` : `₿${b.coin_balance}`}
                </p>
                {i === 0 && <p className="text-[9px] text-yellow-600 font-medium">Líder 👑</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        {transactions.length > 0 && (
          <div className="border-t border-bru-light-gray">
            <button
              onClick={() => setShowActivity(!showActivity)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-bru-warm-gray hover:text-bru-orange transition-colors"
            >
              <span>Actividad reciente</span>
              <span className={`transition-transform duration-200 ${showActivity ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {showActivity && (
              <div className="px-3 pb-3 space-y-2 max-h-40 overflow-y-auto">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-start gap-2">
                    <span className={`text-xs font-bold flex-shrink-0 mt-0.5 ${
                      tx.type === 'earn' ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {tx.type === 'earn' ? '+' : '−'}₿{tx.amount}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-bru-black leading-snug">
                        <span className="font-medium">{tx.baristas?.name}</span>
                        {' — '}
                        <span className="text-bru-warm-gray">{tx.reason}</span>
                      </p>
                      <p className="text-[10px] text-bru-warm-gray/70">
                        {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rules accordion */}
        <div className="border-t border-bru-light-gray">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-bru-warm-gray hover:text-bru-orange transition-colors"
          >
            <span>ℹ️ ¿Cómo ganar ₿?</span>
            <span className={`transition-transform duration-200 ${showRules ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showRules && (
            <div className="px-3 pb-3 text-xs max-h-56 overflow-y-auto space-y-3">
              {earnRules.length > 0 && (
                <div>
                  <p className="font-semibold text-green-700 mb-1.5">✅ Ganar</p>
                  {earnRules.map((r) => (
                    <div key={r.id} className="flex justify-between py-1 border-b border-bru-light-gray/50 last:border-0">
                      <span className="text-bru-black leading-tight">{r.description}</span>
                      <span className="text-green-600 font-bold ml-2 flex-shrink-0">
                        {r.amount > 0 ? `+₿${r.amount}` : '+₿?'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {deductRules.length > 0 && (
                <div>
                  <p className="font-semibold text-red-700 mb-1.5">❌ Perder</p>
                  {deductRules.map((r) => (
                    <div key={r.id} className="flex justify-between py-1 border-b border-bru-light-gray/50 last:border-0">
                      <span className="text-bru-black leading-tight">{r.description}</span>
                      <span className="text-red-600 font-bold ml-2 flex-shrink-0">
                        {r.amount > 0 ? `−₿${r.amount}` : '−₿?'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

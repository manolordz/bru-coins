'use client'

import { useState, useTransition, useEffect } from 'react'
import { addCoins, deductCoins } from '@/lib/actions/admin'
import { Avatar } from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'

interface Barista {
  id: string
  name: string
  avatar_url: string | null
  coin_balance: number
}

interface CoinRule {
  id: string
  description: string
  amount: number
}

interface CoinModalProps {
  barista: Barista
  mode: 'add' | 'deduct'
  onClose: () => void
  onSuccess?: () => void
}

export function CoinModal({ barista, mode, onClose, onSuccess }: CoinModalProps) {
  const [amount, setAmount]     = useState('')
  const [reason, setReason]     = useState('')
  const [error, setError]       = useState('')
  const [rules, setRules]       = useState<CoinRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const isAdd = mode === 'add'

  // Fetch dynamic coin rules on mount
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('coin_rules')
      .select('id, description, amount')
      .eq('type', isAdd ? 'earn' : 'deduct')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setRules(data || [])
        setRulesLoading(false)
      })
  }, [isAdd])

  const handleShortcut = (rule: CoinRule) => {
    setReason(rule.description)
    if (rule.amount > 0) setAmount(String(rule.amount))
    // If amount === 0, only pre-fill reason — admin enters the custom amount
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const amt = parseInt(amount)
    if (!amt || amt <= 0) return setError('Ingresa una cantidad válida.')
    if (!reason.trim())   return setError('El motivo es requerido.')

    startTransition(async () => {
      const result = isAdd
        ? await addCoins(barista.id, amt, reason)
        : await deductCoins(barista.id, amt, reason)

      if (result.error) setError(result.error)
      else { onSuccess?.(); onClose() }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-warm-lg animate-slide-up max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 border-b border-bru-light-gray ${isAdd ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar name={barista.name} avatarUrl={barista.avatar_url} size="md" />
              <div>
                <p className="font-semibold text-bru-black">{barista.name}</p>
                <p className="text-sm text-bru-orange">₿{barista.coin_balance} actuales</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-bru-warm-gray hover:text-bru-black text-lg">×</button>
          </div>
          <h2 className={`font-display text-xl font-semibold ${isAdd ? 'text-green-700' : 'text-red-700'}`}>
            {isAdd ? '+ Agregar ₿' : '− Quitar ₿'}
          </h2>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-bru-black mb-1.5">Cantidad de ₿</label>
              <div className="relative">
                <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 font-slab text-lg font-semibold select-none pointer-events-none ${isAdd ? 'text-green-600' : 'text-red-600'}`}>
                  {isAdd ? '+' : '−'}₿
                </span>
                <input
                  type="number"
                  min="1"
                  max={!isAdd ? barista.coin_balance : undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="input-warm pl-12 text-2xl font-slab font-semibold tabular-nums"
                  required
                />
              </div>
              {!isAdd && amount && parseInt(amount) > barista.coin_balance && (
                <p className="text-red-600 text-xs mt-1">Saldo insuficiente. Máximo ₿{barista.coin_balance}.</p>
              )}
            </div>

            {/* Quick reason shortcuts */}
            <div>
              <label className="block text-sm font-medium text-bru-black mb-2">Motivo rápido</label>
              {rulesLoading ? (
                <div className="flex gap-2 flex-wrap">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-7 w-28 bg-bru-light-gray rounded-full animate-pulse" />
                  ))}
                </div>
              ) : rules.length === 0 ? (
                <p className="text-xs text-bru-warm-gray italic">
                  No hay reglas activas. Ve a Reglas de Coins para agregar.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rules.map((rule) => {
                    const selected = reason === rule.description && (rule.amount === 0 || amount === String(rule.amount))
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => handleShortcut(rule)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          selected
                            ? isAdd
                              ? 'bg-green-100 border-green-400 text-green-700 font-medium'
                              : 'bg-red-100 border-red-400 text-red-700 font-medium'
                            : 'bg-white border-bru-light-gray text-bru-black hover:border-bru-orange hover:text-bru-orange'
                        }`}
                      >
                        {rule.amount > 0
                          ? `${isAdd ? '+' : '−'}${rule.amount} ${rule.description}`
                          : `${rule.description} (₿?)`}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Reason text */}
            <div>
              <label className="block text-sm font-medium text-bru-black mb-1.5">
                Motivo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe el motivo..."
                className="input-warm"
                required
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-60 ${
                isAdd ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isPending
                ? 'Guardando...'
                : isAdd
                  ? `Agregar ₿${amount || '0'} a ${barista.name}`
                  : `Quitar ₿${amount || '0'} de ${barista.name}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createCoinRule, updateCoinRule, deleteCoinRule } from '@/lib/actions/admin'

interface CoinRule {
  id: string
  type: 'earn' | 'deduct'
  description: string
  amount: number
  sort_order: number
  is_active: boolean
}

export default function ReglasPage() {
  const [rules, setRules] = useState<CoinRule[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: 'earn' | 'deduct'; rule?: CoinRule } | null>(null)
  const supabase = createClient()

  const fetchRules = async () => {
    const { data } = await supabase
      .from('coin_rules')
      .select('*')
      .order('type')
      .order('sort_order')
    setRules(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchRules() }, [])

  const earnRules = rules.filter(r => r.type === 'earn')
  const deductRules = rules.filter(r => r.type === 'deduct')

  if (loading) return (
    <div className="p-6 lg:p-8 animate-pulse space-y-3">
      {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-white rounded-2xl" />)}
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-bru-black">Reglas de Coins</h1>
        <p className="text-bru-warm-gray text-sm mt-0.5">
          Define cómo los baristas ganan y pierden ₿. Estas reglas aparecen en la app pública.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Earn rules */}
        <RuleSection
          title="✅ Ganar ₿"
          type="earn"
          rules={earnRules}
          onAdd={() => setModal({ type: 'earn' })}
          onEdit={(r) => setModal({ type: 'earn', rule: r })}
          onRefresh={fetchRules}
        />

        {/* Deduct rules */}
        <RuleSection
          title="❌ Perder ₿"
          type="deduct"
          rules={deductRules}
          onAdd={() => setModal({ type: 'deduct' })}
          onEdit={(r) => setModal({ type: 'deduct', rule: r })}
          onRefresh={fetchRules}
        />
      </div>

      {modal && (
        <RuleModal
          type={modal.type}
          rule={modal.rule}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); fetchRules() }}
        />
      )}
    </div>
  )
}

// ─── Rule Section ─────────────────────────────────────────────────────────────

function RuleSection({
  title, type, rules, onAdd, onEdit, onRefresh,
}: {
  title: string
  type: 'earn' | 'deduct'
  rules: CoinRule[]
  onAdd: () => void
  onEdit: (r: CoinRule) => void
  onRefresh: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const handleToggle = (r: CoinRule) => {
    startTransition(async () => {
      await updateCoinRule(r.id, { is_active: !r.is_active })
      onRefresh()
    })
  }

  const handleDelete = (r: CoinRule) => {
    if (!confirm(`¿Eliminar la regla "${r.description}"?`)) return
    startTransition(async () => {
      await deleteCoinRule(r.id)
      onRefresh()
    })
  }

  const isEarn = type === 'earn'

  return (
    <div className="card-warm overflow-hidden">
      <div className={`px-4 py-3 border-b border-bru-light-gray flex items-center justify-between ${isEarn ? 'bg-green-50' : 'bg-red-50'}`}>
        <h2 className={`font-semibold text-sm ${isEarn ? 'text-green-800' : 'text-red-800'}`}>{title}</h2>
        <button
          onClick={onAdd}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            isEarn
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          + Agregar
        </button>
      </div>

      <div className="divide-y divide-bru-light-gray">
        {rules.length === 0 && (
          <p className="text-center text-bru-warm-gray text-sm py-6">Sin reglas aún.</p>
        )}
        {rules.map((r) => (
          <div key={r.id} className={`flex items-center gap-2 px-4 py-2.5 ${!r.is_active ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-bru-black leading-tight truncate">{r.description}</p>
              <p className={`text-xs font-slab font-bold mt-0.5 ${isEarn ? 'text-green-600' : 'text-red-600'}`}>
                {isEarn ? '+' : '−'}₿{r.amount > 0 ? r.amount : '?'}
              </p>
            </div>
            {/* Active toggle */}
            <button
              onClick={() => handleToggle(r)}
              disabled={isPending}
              title={r.is_active ? 'Desactivar' : 'Activar'}
              className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors duration-200 ${r.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${r.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <button
              onClick={() => onEdit(r)}
              className="flex-shrink-0 text-bru-warm-gray hover:text-bru-orange transition-colors text-sm px-1"
              title="Editar"
            >✏️</button>
            <button
              onClick={() => handleDelete(r)}
              disabled={isPending}
              className="flex-shrink-0 text-bru-warm-gray hover:text-red-500 transition-colors text-sm px-1"
              title="Eliminar"
            >🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Rule Modal ───────────────────────────────────────────────────────────────

function RuleModal({
  type, rule, onClose, onSuccess,
}: {
  type: 'earn' | 'deduct'
  rule?: CoinRule
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!rule
  const isEarn = type === 'earn'
  const [description, setDescription] = useState(rule?.description || '')
  const [amount, setAmount] = useState(rule?.amount != null ? String(rule.amount) : '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!description.trim()) return setError('La descripción es requerida.')
    if (amount === '' || parseInt(amount) < 0) return setError('El monto debe ser 0 o mayor.')

    startTransition(async () => {
      const result = isEdit
        ? await updateCoinRule(rule!.id, { description: description.trim(), amount: parseInt(amount) })
        : await createCoinRule({ type, description: description.trim(), amount: parseInt(amount) })

      if (result.error) setError(result.error)
      else onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-warm-lg animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-bru-light-gray">
          <h2 className="font-display text-lg font-semibold">
            {isEdit ? 'Editar regla' : `Nueva regla (${isEarn ? 'ganar' : 'perder'})`}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bru-light-gray flex items-center justify-center text-lg">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">Descripción <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej. Corte de caja perfecto"
              className="input-warm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">
              Coins {isEarn ? 'a ganar' : 'a perder'} <span className="text-bru-warm-gray font-normal">(0 = variable)</span>
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-slab text-lg font-semibold select-none pointer-events-none ${isEarn ? 'text-green-600' : 'text-red-600'}`}>
                {isEarn ? '+' : '−'}₿
              </span>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="input-warm pl-11 text-xl font-slab font-semibold tabular-nums"
                required
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-xl">{error}</p>}

          <button type="submit" disabled={isPending} className="btn-orange w-full disabled:opacity-60">
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear regla'}
          </button>
        </form>
      </div>
    </div>
  )
}

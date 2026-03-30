'use client'

import { useState, useTransition } from 'react'
import { addCoins, deductCoins } from '@/lib/actions/admin'
import { Avatar } from '@/components/ui/Avatar'

interface Barista {
  id: string
  name: string
  avatar_url: string | null
  coin_balance: number
}

interface CoinModalProps {
  barista: Barista
  mode: 'add' | 'deduct'
  onClose: () => void
  onSuccess?: () => void
}

const EARN_SHORTCUTS = [
  { label: 'Tarjeta de sellos', amount: 1 },
  { label: 'Corte de caja perfecto', amount: 2 },
  { label: 'Shoutout / mención', amount: 2 },
  { label: 'Proponer idea útil', amount: 2 },
  { label: 'Grano de plata', amount: 2 },
  { label: 'Grano de oro', amount: 5 },
  { label: '0 faltas en el mes', amount: 5 },
  { label: 'Review positivo', amount: 5 },
  { label: 'Puntualidad impecable', amount: 5 },
  { label: 'Cubrir turno emergencia', amount: 10 },
]

const DEDUCT_SHORTCUTS = [
  { label: 'No usar mandil', amount: 1 },
  { label: 'No marcar bebidas', amount: 1 },
  { label: 'Llegada tarde (5 min)', amount: 2 },
  { label: 'No hacer check-in/out', amount: 2 },
  { label: 'Olvidar órdenes', amount: 5 },
  { label: 'No enviar checklist', amount: 5 },
  { label: 'Falta sin avisar', amount: 10 },
]

export function CoinModal({ barista, mode, onClose, onSuccess }: CoinModalProps) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const shortcuts = mode === 'add' ? EARN_SHORTCUTS : DEDUCT_SHORTCUTS
  const isAdd = mode === 'add'

  const handleShortcut = (s: { label: string; amount: number }) => {
    setAmount(String(s.amount))
    setReason(s.label)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const amt = parseInt(amount)
    if (!amt || amt <= 0) return setError('Ingresa una cantidad válida.')
    if (!reason.trim()) return setError('El motivo es requerido.')

    startTransition(async () => {
      const result = isAdd
        ? await addCoins(barista.id, amt, reason)
        : await deductCoins(barista.id, amt, reason)

      if (result.error) {
        setError(result.error)
      } else {
        onSuccess?.()
        onClose()
      }
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
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-bru-warm-gray hover:text-bru-black text-lg">
              ×
            </button>
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
              <label className="block text-sm font-medium text-bru-black mb-1.5">
                Cantidad de ₿
              </label>
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
                <p className="text-red-600 text-xs mt-1">
                  Saldo insuficiente. Máximo ₿{barista.coin_balance}.
                </p>
              )}
            </div>

            {/* Reason shortcuts */}
            <div>
              <label className="block text-sm font-medium text-bru-black mb-2">
                Motivo rápido
              </label>
              <div className="flex flex-wrap gap-2">
                {shortcuts.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => handleShortcut(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      reason === s.label && amount === String(s.amount)
                        ? isAdd
                          ? 'bg-green-100 border-green-400 text-green-700 font-medium'
                          : 'bg-red-100 border-red-400 text-red-700 font-medium'
                        : 'bg-white border-bru-light-gray text-bru-black hover:border-bru-orange hover:text-bru-orange'
                    }`}
                  >
                    {isAdd ? `+${s.amount}` : `-${s.amount}`} {s.label}
                  </button>
                ))}
              </div>
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
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
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

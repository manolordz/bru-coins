'use client'

import { useState, useCallback, useEffect } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { PINPad } from '@/components/redemption/PINPad'
import { verifyBaristaPin, submitCoinRequest } from '@/lib/actions/barista'
import type { CoinRequestItem } from '@/lib/actions/barista'

type Step = 'select-barista' | 'enter-pin' | 'select-rules' | 'confirm' | 'success'

interface Barista {
  id: string
  name: string
  avatar_url: string | null
  coin_balance: number
}

export interface EarnRule {
  id: string
  description: string
  amount: number
}

interface CoinRequestModalProps {
  isOpen: boolean
  onClose: () => void
  baristas: Barista[]
  earnRules: EarnRule[]
}

const LOCKOUT_DURATION = 5 * 60 * 1000
const MAX_ATTEMPTS = 3

function getLockoutState(baristaId: string): { locked: boolean; remaining: number; attemptsLeft: number } {
  if (typeof window === 'undefined') return { locked: false, remaining: 0, attemptsLeft: MAX_ATTEMPTS }
  const lockKey = `pin_lock_${baristaId}`
  const attKey = `pin_att_${baristaId}`
  const lockUntil = parseInt(localStorage.getItem(lockKey) || '0')
  const attempts = parseInt(localStorage.getItem(attKey) || '0')

  if (lockUntil > Date.now()) {
    const remaining = Math.ceil((lockUntil - Date.now()) / 1000 / 60)
    return { locked: true, remaining, attemptsLeft: 0 }
  }
  if (lockUntil > 0 && lockUntil <= Date.now()) {
    localStorage.removeItem(lockKey)
    localStorage.removeItem(attKey)
    return { locked: false, remaining: 0, attemptsLeft: MAX_ATTEMPTS }
  }
  return { locked: false, remaining: 0, attemptsLeft: MAX_ATTEMPTS - attempts }
}

function recordFailedAttempt(baristaId: string) {
  const attKey = `pin_att_${baristaId}`
  const lockKey = `pin_lock_${baristaId}`
  const attempts = parseInt(localStorage.getItem(attKey) || '0') + 1
  localStorage.setItem(attKey, String(attempts))
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(lockKey, String(Date.now() + LOCKOUT_DURATION))
  }
  return attempts
}

function clearAttempts(baristaId: string) {
  localStorage.removeItem(`pin_att_${baristaId}`)
  localStorage.removeItem(`pin_lock_${baristaId}`)
}

// ─── Selection state per rule ─────────────────────────────────────────────────

interface RuleSelection {
  rule: EarnRule
  quantity: number
  customAmount: number | ''  // only used when rule.amount === 0
}

export function CoinRequestModal({ isOpen, onClose, baristas, earnRules }: CoinRequestModalProps) {
  const [step, setStep] = useState<Step>('select-barista')
  const [selectedBarista, setSelectedBarista] = useState<Barista | null>(null)
  const [verifiedBarista, setVerifiedBarista] = useState<{ id: string; name: string; avatar_url: string | null; coin_balance: number } | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lockState, setLockState] = useState({ locked: false, remaining: 0, attemptsLeft: MAX_ATTEMPTS })
  const [selections, setSelections] = useState<Map<string, RuleSelection>>(new Map())

  const reset = useCallback(() => {
    setStep('select-barista')
    setSelectedBarista(null)
    setVerifiedBarista(null)
    setPin('')
    setPinError('')
    setSelections(new Map())
    setIsSubmitting(false)
  }, [])

  const handleClose = () => {
    reset()
    onClose()
  }

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && step === 'enter-pin' && !isVerifying) {
      handleVerifyPin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  // ─── Step 1: select barista ─────────────────────────────────────────────────

  const handleSelectBarista = (barista: Barista) => {
    setSelectedBarista(barista)
    const state = getLockoutState(barista.id)
    setLockState(state)
    setPin('')
    setPinError('')
    setStep('enter-pin')
  }

  // ─── Step 2: verify PIN ─────────────────────────────────────────────────────

  const handleVerifyPin = async () => {
    if (!selectedBarista || isVerifying || pin.length !== 4) return
    const state = getLockoutState(selectedBarista.id)
    if (state.locked) {
      setPinError(`Demasiados intentos. Espera ${state.remaining} minuto${state.remaining !== 1 ? 's' : ''}.`)
      return
    }
    setIsVerifying(true)
    const result = await verifyBaristaPin(selectedBarista.id, pin)
    setIsVerifying(false)

    if (result.success) {
      clearAttempts(selectedBarista.id)
      setVerifiedBarista(result.barista)
      setPin('')
      setPinError('')
      setStep('select-rules')
    } else {
      const attempts = recordFailedAttempt(selectedBarista.id)
      const newState = getLockoutState(selectedBarista.id)
      setLockState(newState)
      if (newState.locked) {
        setPinError('PIN incorrecto. Cuenta bloqueada por 5 minutos.')
      } else {
        const left = MAX_ATTEMPTS - attempts
        setPinError(`PIN incorrecto. ${left} intento${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''}.`)
      }
      setPin('')
    }
  }

  // ─── Step 3: rule selection helpers ────────────────────────────────────────

  const toggleRule = (rule: EarnRule) => {
    setSelections(prev => {
      const next = new Map(prev)
      if (next.has(rule.id)) {
        next.delete(rule.id)
      } else {
        next.set(rule.id, { rule, quantity: 1, customAmount: rule.amount === 0 ? '' : rule.amount })
      }
      return next
    })
  }

  const setQuantity = (ruleId: string, qty: number) => {
    setSelections(prev => {
      const next = new Map(prev)
      const sel = next.get(ruleId)
      if (sel) next.set(ruleId, { ...sel, quantity: Math.max(1, qty) })
      return next
    })
  }

  const setCustomAmount = (ruleId: string, val: number | '') => {
    setSelections(prev => {
      const next = new Map(prev)
      const sel = next.get(ruleId)
      if (sel) next.set(ruleId, { ...sel, customAmount: val })
      return next
    })
  }

  // Computed items for submit / confirm view
  const buildItems = (): CoinRequestItem[] => {
    return Array.from(selections.values())
      .filter(sel => {
        if (sel.rule.amount === 0) return typeof sel.customAmount === 'number' && sel.customAmount > 0
        return true
      })
      .map(sel => {
        const unitAmount = sel.rule.amount === 0 ? (sel.customAmount as number) : sel.rule.amount
        return {
          ruleId: sel.rule.id,
          description: sel.rule.description,
          amount: unitAmount,
          quantity: sel.quantity,
          subtotal: unitAmount * sel.quantity,
        }
      })
  }

  const total = buildItems().reduce((sum, i) => sum + i.subtotal, 0)

  // ─── Step 4: submit ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!verifiedBarista || isSubmitting) return
    const items = buildItems()
    if (!items.length || total <= 0) return
    setIsSubmitting(true)
    const result = await submitCoinRequest(verifiedBarista.id, items, total)
    setIsSubmitting(false)

    if (result.success) {
      setStep('success')
    } else {
      setPinError(result.error)
    }
  }

  if (!isOpen) return null

  const STEPS: Step[] = ['select-barista', 'enter-pin', 'select-rules', 'confirm']

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-bru-cream rounded-t-3xl sm:rounded-3xl shadow-warm-lg animate-slide-up max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-bru-light-gray">
          <div>
            <h2 className="font-display text-xl font-semibold text-bru-black">
              {step === 'select-barista' && '¿Quién eres?'}
              {step === 'enter-pin'      && 'Confirma tu identidad'}
              {step === 'select-rules'   && 'Selecciona tus coins'}
              {step === 'confirm'        && 'Revisar solicitud'}
              {step === 'success'        && '¡Solicitud enviada!'}
            </h2>
            {/* Progress dots */}
            <div className="flex gap-1.5 mt-2">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    step === 'success' || STEPS.indexOf(step) >= i
                      ? 'bg-bru-orange w-6'
                      : 'bg-bru-light-gray w-4'
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-bru-light-gray flex items-center justify-center text-bru-warm-gray hover:bg-bru-parchment transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Select barista ── */}
          {step === 'select-barista' && (
            <div className="p-6">
              <p className="text-bru-warm-gray text-sm mb-5">Toca tu foto para continuar</p>
              <div className="grid grid-cols-3 gap-4">
                {baristas.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBarista(b)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-white hover:shadow-card active:scale-95 transition-all duration-150"
                  >
                    <div className="ring-2 ring-transparent hover:ring-bru-orange rounded-full transition-all">
                      <Avatar name={b.name} avatarUrl={b.avatar_url} size="lg" />
                    </div>
                    <span className="text-sm font-medium text-bru-black text-center leading-tight">{b.name}</span>
                    <span className="text-xs text-bru-orange font-semibold">₿{b.coin_balance}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Enter PIN ── */}
          {step === 'enter-pin' && selectedBarista && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6 p-4 bg-white rounded-2xl shadow-card">
                <Avatar name={selectedBarista.name} avatarUrl={selectedBarista.avatar_url} size="md" />
                <div>
                  <p className="font-semibold text-bru-black">{selectedBarista.name}</p>
                  <p className="text-sm text-bru-warm-gray">Ingresa tu PIN de 4 dígitos</p>
                </div>
              </div>

              {pinError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
                  {pinError}
                </div>
              )}

              {lockState.locked ? (
                <div className="text-center py-8 text-bru-warm-gray">
                  <div className="text-4xl mb-3">🔒</div>
                  <p className="font-medium">Cuenta bloqueada temporalmente</p>
                  <p className="text-sm mt-1">Espera {lockState.remaining} minuto{lockState.remaining !== 1 ? 's' : ''} e inténtalo de nuevo.</p>
                </div>
              ) : (
                <PINPad value={pin} onChange={setPin} disabled={isVerifying || lockState.locked} />
              )}

              {isVerifying && (
                <div className="mt-4 text-center text-bru-warm-gray text-sm animate-pulse">Verificando...</div>
              )}

              <button
                onClick={() => { setStep('select-barista'); setPin(''); setPinError('') }}
                className="mt-6 w-full text-sm text-bru-warm-gray hover:text-bru-orange transition-colors text-center"
              >
                ← Volver
              </button>
            </div>
          )}

          {/* ── Step 3: Select rules ── */}
          {step === 'select-rules' && verifiedBarista && (
            <div className="p-4 pb-28">
              <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-2xl shadow-card">
                <Avatar name={verifiedBarista.name} avatarUrl={verifiedBarista.avatar_url} size="sm" />
                <p className="font-semibold text-sm text-bru-black flex-1">{verifiedBarista.name}</p>
                <span className="font-slab font-bold text-bru-orange">₿{verifiedBarista.coin_balance}</span>
              </div>

              <p className="text-xs text-bru-warm-gray mb-3 px-1">
                Selecciona los logros de este período. Serán revisados por el admin antes de acreditarse.
              </p>

              <div className="space-y-2">
                {earnRules.map((rule) => {
                  const sel = selections.get(rule.id)
                  const isSelected = !!sel
                  return (
                    <div
                      key={rule.id}
                      className={`rounded-2xl border transition-all duration-150 overflow-hidden ${
                        isSelected
                          ? 'bg-green-50 border-green-300'
                          : 'bg-white border-bru-light-gray'
                      }`}
                    >
                      {/* Main row */}
                      <button
                        onClick={() => toggleRule(rule)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-green-500 border-green-500' : 'border-bru-light-gray'
                        }`}>
                          {isSelected && <span className="text-white text-xs leading-none">✓</span>}
                        </div>
                        <span className="flex-1 text-sm font-medium text-bru-black leading-tight">{rule.description}</span>
                        <span className={`font-slab font-bold text-sm flex-shrink-0 ${isSelected ? 'text-green-600' : 'text-bru-warm-gray'}`}>
                          {rule.amount > 0 ? `+₿${rule.amount}` : '+₿?'}
                        </span>
                      </button>

                      {/* Expanded controls */}
                      {isSelected && (
                        <div className="px-4 pb-3 flex items-center gap-3">
                          {/* Quantity stepper */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-bru-warm-gray">Cantidad:</span>
                            <button
                              onClick={() => setQuantity(rule.id, (sel.quantity) - 1)}
                              disabled={sel.quantity <= 1}
                              className="w-7 h-7 rounded-lg bg-bru-parchment text-bru-black font-bold text-sm flex items-center justify-center disabled:opacity-30 hover:bg-bru-light-gray transition-colors"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-semibold tabular-nums">{sel.quantity}</span>
                            <button
                              onClick={() => setQuantity(rule.id, (sel.quantity) + 1)}
                              className="w-7 h-7 rounded-lg bg-bru-parchment text-bru-black font-bold text-sm flex items-center justify-center hover:bg-bru-light-gray transition-colors"
                            >
                              +
                            </button>
                          </div>

                          {/* Custom amount for variable rules */}
                          {rule.amount === 0 && (
                            <div className="flex items-center gap-1 ml-2">
                              <span className="text-xs text-bru-warm-gray">Monto:</span>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 font-slab text-sm font-semibold text-green-600 pointer-events-none">₿</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={sel.customAmount}
                                  onChange={e => setCustomAmount(rule.id, e.target.value === '' ? '' : parseInt(e.target.value))}
                                  placeholder="0"
                                  className="w-16 pl-6 pr-1 py-1 text-sm font-semibold tabular-nums bg-white border border-bru-light-gray rounded-lg focus:outline-none focus:border-bru-orange"
                                />
                              </div>
                            </div>
                          )}

                          {/* Subtotal */}
                          <span className="ml-auto font-slab font-bold text-sm text-green-700">
                            {rule.amount > 0 || (typeof sel.customAmount === 'number' && sel.customAmount > 0)
                              ? `+₿${(rule.amount > 0 ? rule.amount : (sel.customAmount as number)) * sel.quantity}`
                              : '+₿?'}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Step 4: Confirm ── */}
          {step === 'confirm' && verifiedBarista && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5 p-3 bg-white rounded-2xl shadow-card">
                <Avatar name={verifiedBarista.name} avatarUrl={verifiedBarista.avatar_url} size="sm" />
                <p className="font-semibold text-sm text-bru-black flex-1">{verifiedBarista.name}</p>
              </div>

              <div className="card-warm overflow-hidden mb-5">
                <div className="px-4 py-2.5 bg-green-50 border-b border-bru-light-gray">
                  <p className="text-xs font-semibold text-green-800">Detalle de la solicitud</p>
                </div>
                <div className="divide-y divide-bru-light-gray">
                  {buildItems().map((item, i) => (
                    <div key={i} className="flex items-baseline justify-between px-4 py-2.5 text-sm">
                      <span className="text-bru-black flex-1 leading-tight">{item.description}</span>
                      <span className="text-bru-warm-gray text-xs mx-2 flex-shrink-0">
                        {item.quantity > 1 ? `×${item.quantity}` : ''}
                      </span>
                      <span className="font-slab font-bold text-green-700 flex-shrink-0">+₿{item.subtotal}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-bru-parchment border-t border-bru-light-gray flex items-center justify-between">
                  <span className="font-semibold text-sm text-bru-black">Total a solicitar</span>
                  <span className="font-slab font-bold text-xl text-bru-orange">+₿{total}</span>
                </div>
              </div>

              <p className="text-xs text-bru-warm-gray text-center mb-5 px-4">
                Los coins se acreditarán a tu saldo cuando el administrador apruebe la solicitud.
              </p>

              {pinError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
                  {pinError}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-orange w-full disabled:opacity-60"
              >
                {isSubmitting ? 'Enviando...' : `Enviar solicitud de +₿${total}`}
              </button>
              <button
                onClick={() => setStep('select-rules')}
                className="mt-3 w-full text-sm text-bru-warm-gray hover:text-bru-orange transition-colors text-center"
              >
                ← Modificar selección
              </button>
            </div>
          )}

          {/* ── Step 5: Success ── */}
          {step === 'success' && verifiedBarista && (
            <div className="p-6 text-center">
              <div className="text-6xl mb-4 animate-bounce-coin inline-block">📬</div>
              <h3 className="font-display text-2xl font-semibold text-bru-black mb-2">
                ¡Listo, {verifiedBarista.name}!
              </h3>
              <p className="text-bru-warm-gray mb-6">
                Tu solicitud fue enviada al administrador. Te avisaremos cuando sea aprobada.
              </p>

              <div className="card-warm p-5 mb-6 text-left space-y-2">
                {buildItems().map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-bru-black">{item.description}</span>
                    <span className="font-slab font-bold text-green-700">+₿{item.subtotal}</span>
                  </div>
                ))}
                <div className="border-t border-bru-light-gray pt-2 flex justify-between">
                  <span className="font-semibold">Total solicitado</span>
                  <span className="font-slab font-bold text-bru-orange text-lg">+₿{total}</span>
                </div>
              </div>

              <button onClick={handleClose} className="btn-orange w-full">
                Cerrar
              </button>
            </div>
          )}

        </div>

        {/* ── Step 3 sticky footer ── */}
        {step === 'select-rules' && (
          <div className="px-4 pb-4 pt-3 border-t border-bru-light-gray bg-bru-cream">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-bru-warm-gray">
                {selections.size} razón{selections.size !== 1 ? 'es' : ''} seleccionada{selections.size !== 1 ? 's' : ''}
              </span>
              <span className="font-slab font-bold text-bru-orange">
                {total > 0 ? `+₿${total}` : '₿0'}
              </span>
            </div>
            <button
              onClick={() => {
                const items = buildItems()
                if (!items.length) return
                setPinError('')
                setStep('confirm')
              }}
              disabled={buildItems().length === 0}
              className="btn-orange w-full disabled:opacity-40"
            >
              Revisar solicitud →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

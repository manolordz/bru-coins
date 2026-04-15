'use client'

import { useState, useCallback, useEffect } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { PINPad } from '@/components/redemption/PINPad'
import { verifyBaristaPin, submitProposal } from '@/lib/actions/barista'

type Step = 'form' | 'select-barista' | 'enter-pin' | 'success'

type IdeaType = 'nueva_recompensa' | 'idea_mejora' | 'otro'

interface Barista {
  id: string
  name: string
  avatar_url: string | null
  coin_balance: number
}

interface ProposalModalProps {
  isOpen: boolean
  onClose: () => void
  baristas: Barista[]
}

const IDEA_OPTIONS: { value: IdeaType; label: string; emoji: string }[] = [
  { value: 'nueva_recompensa', label: 'Nueva recompensa',   emoji: '🎁' },
  { value: 'idea_mejora',      label: 'Idea de mejora',     emoji: '🔧' },
  { value: 'otro',             label: 'Otro comentario',    emoji: '💬' },
]

const LOCKOUT_DURATION = 5 * 60 * 1000
const MAX_ATTEMPTS = 3

function getLockoutState(baristaId: string): { locked: boolean; remaining: number; attemptsLeft: number } {
  if (typeof window === 'undefined') return { locked: false, remaining: 0, attemptsLeft: MAX_ATTEMPTS }
  const lockKey  = `pin_lock_${baristaId}`
  const attKey   = `pin_att_${baristaId}`
  const lockUntil = parseInt(localStorage.getItem(lockKey) || '0')
  const attempts  = parseInt(localStorage.getItem(attKey)  || '0')
  if (lockUntil > Date.now()) {
    return { locked: true, remaining: Math.ceil((lockUntil - Date.now()) / 60000), attemptsLeft: 0 }
  }
  if (lockUntil > 0) {
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
  if (attempts >= MAX_ATTEMPTS) localStorage.setItem(lockKey, String(Date.now() + LOCKOUT_DURATION))
  return attempts
}

function clearAttempts(baristaId: string) {
  localStorage.removeItem(`pin_att_${baristaId}`)
  localStorage.removeItem(`pin_lock_${baristaId}`)
}

export function ProposalModal({ isOpen, onClose, baristas }: ProposalModalProps) {
  const [step, setStep]                     = useState<Step>('form')
  const [ideaType, setIdeaType]             = useState<IdeaType>('nueva_recompensa')
  const [message, setMessage]               = useState('')
  const [formError, setFormError]           = useState('')
  const [selectedBarista, setSelectedBarista] = useState<Barista | null>(null)
  const [verifiedBaristaId, setVerifiedBaristaId] = useState<string | null>(null)
  const [pin, setPin]                       = useState('')
  const [pinError, setPinError]             = useState('')
  const [isVerifying, setIsVerifying]       = useState(false)
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [lockState, setLockState]           = useState({ locked: false, remaining: 0, attemptsLeft: MAX_ATTEMPTS })

  const reset = useCallback(() => {
    setStep('form')
    setIdeaType('nueva_recompensa')
    setMessage('')
    setFormError('')
    setSelectedBarista(null)
    setVerifiedBaristaId(null)
    setPin('')
    setPinError('')
    setIsSubmitting(false)
  }, [])

  const handleClose = () => { reset(); onClose() }

  // Auto-submit PIN when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && step === 'enter-pin' && !isVerifying) {
      handleVerifyPin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  // ── Step 1: submit form ──────────────────────────────────────────────────
  const handleFormNext = () => {
    setFormError('')
    if (message.trim().length < 10) {
      setFormError('El mensaje debe tener al menos 10 caracteres.')
      return
    }
    setStep('select-barista')
  }

  // ── Step 2: select barista ───────────────────────────────────────────────
  const handleSelectBarista = (b: Barista) => {
    setSelectedBarista(b)
    setLockState(getLockoutState(b.id))
    setPin('')
    setPinError('')
    setStep('enter-pin')
  }

  // ── Step 3: verify PIN ───────────────────────────────────────────────────
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
      setVerifiedBaristaId(result.barista.id)
      setPin('')
      setPinError('')
      // Submit immediately after PIN verified
      await handleSubmit(result.barista.id)
    } else {
      const attempts = recordFailedAttempt(selectedBarista.id)
      const newState = getLockoutState(selectedBarista.id)
      setLockState(newState)
      const left = MAX_ATTEMPTS - attempts
      setPinError(
        newState.locked
          ? 'PIN incorrecto. Cuenta bloqueada por 5 minutos.'
          : `PIN incorrecto. ${left} intento${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''}.`
      )
      setPin('')
    }
  }

  // ── Final submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (baristaId: string) => {
    setIsSubmitting(true)
    const result = await submitProposal(baristaId, ideaType, message)
    setIsSubmitting(false)
    if (result.success) {
      setStep('success')
    } else {
      setPinError(result.error)
    }
  }

  if (!isOpen) return null

  const STEPS: Step[] = ['form', 'select-barista', 'enter-pin']

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={handleClose} />

      <div className="relative w-full sm:max-w-md bg-bru-cream rounded-t-3xl sm:rounded-3xl shadow-warm-lg animate-slide-up max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-bru-light-gray">
          <div>
            <h2 className="font-display text-xl font-semibold text-bru-black">
              {step === 'form'           && 'Proponer una idea'}
              {step === 'select-barista' && '¿Quién eres?'}
              {step === 'enter-pin'      && 'Confirma tu identidad'}
              {step === 'success'        && '¡Gracias!'}
            </h2>
            <div className="flex gap-1.5 mt-2">
              {STEPS.map((s, i) => (
                <div key={s} className={`h-1 rounded-full transition-all duration-300 ${
                  step === 'success' || STEPS.indexOf(step) >= i ? 'bg-bru-orange w-6' : 'bg-bru-light-gray w-4'
                }`} />
              ))}
            </div>
          </div>
          <button onClick={handleClose} className="w-9 h-9 rounded-full bg-bru-light-gray flex items-center justify-center text-bru-warm-gray hover:bg-bru-parchment text-lg">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Form ── */}
          {step === 'form' && (
            <div className="p-6 space-y-5">
              {/* Idea type */}
              <div>
                <label className="block text-sm font-medium text-bru-black mb-2">Tipo de idea</label>
                <div className="space-y-2">
                  {IDEA_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIdeaType(opt.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all duration-150 ${
                        ideaType === opt.value
                          ? 'bg-bru-orange/10 border-bru-orange text-bru-black'
                          : 'bg-white border-bru-light-gray text-bru-black hover:border-bru-orange/50'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        ideaType === opt.value ? 'border-bru-orange' : 'border-bru-light-gray'
                      }`}>
                        {ideaType === opt.value && <span className="w-2.5 h-2.5 rounded-full bg-bru-orange" />}
                      </span>
                      <span className="text-base">{opt.emoji}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-bru-black mb-1.5">
                  Tu propuesta <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe tu idea con el mayor detalle posible..."
                  rows={4}
                  className="input-warm resize-none"
                  required
                />
                <p className={`text-xs mt-1 text-right ${message.length < 10 ? 'text-bru-warm-gray' : 'text-green-600'}`}>
                  {message.length} / mín. 10 caracteres
                </p>
              </div>

              {formError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <button
                onClick={handleFormNext}
                className="btn-orange w-full"
              >
                Continuar → Verificar identidad
              </button>
            </div>
          )}

          {/* ── Step 2: Select barista ── */}
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
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('form')} className="mt-6 w-full text-sm text-bru-warm-gray hover:text-bru-orange transition-colors text-center">
                ← Volver
              </button>
            </div>
          )}

          {/* ── Step 3: Enter PIN ── */}
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
                <PINPad value={pin} onChange={setPin} disabled={isVerifying || isSubmitting || lockState.locked} />
              )}

              {(isVerifying || isSubmitting) && (
                <div className="mt-4 text-center text-bru-warm-gray text-sm animate-pulse">
                  {isSubmitting ? 'Enviando propuesta...' : 'Verificando...'}
                </div>
              )}

              <button onClick={() => { setStep('select-barista'); setPin(''); setPinError('') }}
                className="mt-6 w-full text-sm text-bru-warm-gray hover:text-bru-orange transition-colors text-center">
                ← Cambiar barista
              </button>
            </div>
          )}

          {/* ── Step 4: Success ── */}
          {step === 'success' && (
            <div className="p-6 text-center">
              <div className="text-6xl mb-4 animate-bounce-coin inline-block">💡</div>
              <h3 className="font-display text-2xl font-semibold text-bru-black mb-3">
                ¡Gracias por tu propuesta!
              </h3>
              <p className="text-bru-warm-gray mb-8">
                La revisaremos pronto. Tu opinión ayuda a mejorar BRÜ. 🙌
              </p>
              <div className="card-warm p-4 mb-6 text-left">
                <p className="text-xs text-bru-warm-gray mb-1">Tipo de idea</p>
                <p className="font-medium text-sm text-bru-black mb-3">
                  {IDEA_OPTIONS.find(o => o.value === ideaType)?.emoji}{' '}
                  {IDEA_OPTIONS.find(o => o.value === ideaType)?.label}
                </p>
                <p className="text-xs text-bru-warm-gray mb-1">Tu propuesta</p>
                <p className="text-sm text-bru-black leading-relaxed">{message}</p>
              </div>
              <button onClick={handleClose} className="btn-orange w-full">Cerrar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

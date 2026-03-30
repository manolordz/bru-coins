'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { Avatar } from '@/components/ui/Avatar'
import { PINPad } from './PINPad'
import { verifyBaristaPin, redeemReward } from '@/lib/actions/barista'

type Step = 'select-barista' | 'enter-pin' | 'select-reward' | 'confirm' | 'success'

interface Barista {
  id: string
  name: string
  avatar_url: string | null
  coin_balance: number
}

interface Reward {
  id: string
  name: string
  description: string | null
  image_url: string | null
  price: number
  is_available: boolean
}

interface RedemptionModalProps {
  isOpen: boolean
  onClose: () => void
  baristas: Barista[]
  rewards: Reward[]
}

const LOCKOUT_DURATION = 5 * 60 * 1000 // 5 minutes in ms
const MAX_ATTEMPTS = 3

function getLockoutState(baristaId: string) {
  if (typeof window === 'undefined') return { locked: false, attemptsLeft: MAX_ATTEMPTS }
  const lockKey = `pin_lock_${baristaId}`
  const attKey = `pin_att_${baristaId}`
  const lockUntil = parseInt(localStorage.getItem(lockKey) || '0')
  const attempts = parseInt(localStorage.getItem(attKey) || '0')

  if (lockUntil > Date.now()) {
    const remaining = Math.ceil((lockUntil - Date.now()) / 1000 / 60)
    return { locked: true, remaining, attemptsLeft: 0 }
  }

  // Clear expired lock
  if (lockUntil > 0 && lockUntil <= Date.now()) {
    localStorage.removeItem(lockKey)
    localStorage.removeItem(attKey)
    return { locked: false, attemptsLeft: MAX_ATTEMPTS }
  }

  return { locked: false, attemptsLeft: MAX_ATTEMPTS - attempts }
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

export function RedemptionModal({ isOpen, onClose, baristas, rewards }: RedemptionModalProps) {
  const [step, setStep] = useState<Step>('select-barista')
  const [selectedBarista, setSelectedBarista] = useState<Barista | null>(null)
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [lockState, setLockState] = useState({ locked: false, remaining: 0, attemptsLeft: MAX_ATTEMPTS })
  const [verifiedBarista, setVerifiedBarista] = useState<Barista | null>(null)
  const [successData, setSuccessData] = useState<{ rewardName: string; newBalance: number } | null>(null)

  const reset = useCallback(() => {
    setStep('select-barista')
    setSelectedBarista(null)
    setSelectedReward(null)
    setVerifiedBarista(null)
    setPin('')
    setPinError('')
    setSuccessData(null)
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

  const handleSelectBarista = (barista: Barista) => {
    setSelectedBarista(barista)
    const state = getLockoutState(barista.id)
    setLockState(state)
    setPin('')
    setPinError('')
    setStep('enter-pin')
  }

  const handleVerifyPin = async () => {
    if (!selectedBarista || isVerifying) return
    if (pin.length !== 4) return

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
      setStep('select-reward')
    } else {
      const attempts = recordFailedAttempt(selectedBarista.id)
      const newState = getLockoutState(selectedBarista.id)
      setLockState(newState)

      if (newState.locked) {
        setPinError(`PIN incorrecto. Cuenta bloqueada por 5 minutos.`)
      } else {
        setPinError(`PIN incorrecto. ${MAX_ATTEMPTS - attempts} intento${MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} restante${MAX_ATTEMPTS - attempts !== 1 ? 's' : ''}.`)
      }
      setPin('')
    }
  }

  const handleSelectReward = (reward: Reward) => {
    if (!verifiedBarista) return
    if (reward.price > verifiedBarista.coin_balance) return
    setSelectedReward(reward)
    setStep('confirm')
  }

  const handleConfirm = async () => {
    if (!verifiedBarista || !selectedReward || isRedeeming) return
    setIsRedeeming(true)

    const result = await redeemReward(verifiedBarista.id, selectedReward.id)
    setIsRedeeming(false)

    if (result.success) {
      setSuccessData({ rewardName: result.rewardName, newBalance: result.newBalance })
      setStep('success')
    } else {
      setPinError(result.error)
      setStep('confirm')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-bru-cream rounded-t-3xl sm:rounded-3xl shadow-warm-lg animate-slide-up max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-bru-light-gray">
          <div>
            <h2 className="font-display text-xl font-semibold text-bru-black">
              {step === 'select-barista' && '¿Quién eres?'}
              {step === 'enter-pin' && 'Ingresa tu PIN'}
              {step === 'select-reward' && 'Elige tu recompensa'}
              {step === 'confirm' && 'Confirmar canje'}
              {step === 'success' && '¡Canje exitoso!'}
            </h2>
            {/* Step indicator */}
            <div className="flex gap-1.5 mt-2">
              {(['select-barista', 'enter-pin', 'select-reward', 'confirm'] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    step === 'success' || ['select-barista', 'enter-pin', 'select-reward', 'confirm'].indexOf(step) >= i
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
          {/* Step 1: Select barista */}
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

          {/* Step 2: Enter PIN */}
          {step === 'enter-pin' && selectedBarista && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6 p-4 bg-white rounded-2xl shadow-card">
                <Avatar name={selectedBarista.name} avatarUrl={selectedBarista.avatar_url} size="md" />
                <div>
                  <p className="font-semibold text-bru-black">{selectedBarista.name}</p>
                  <p className="text-sm text-bru-orange font-medium">₿{selectedBarista.coin_balance} disponibles</p>
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
                <PINPad
                  value={pin}
                  onChange={setPin}
                  disabled={isVerifying || lockState.locked}
                />
              )}

              {isVerifying && (
                <div className="mt-4 text-center text-bru-warm-gray text-sm animate-pulse">
                  Verificando...
                </div>
              )}

              <button
                onClick={() => { setStep('select-barista'); setPin(''); setPinError('') }}
                className="mt-6 w-full text-sm text-bru-warm-gray hover:text-bru-orange transition-colors text-center"
              >
                ← Volver
              </button>
            </div>
          )}

          {/* Step 3: Select reward */}
          {step === 'select-reward' && verifiedBarista && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-bru-warm-gray text-sm">Saldo disponible</p>
                <span className="text-2xl font-display font-semibold text-bru-orange">₿{verifiedBarista.coin_balance}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {rewards.map((r) => {
                  const canAfford = verifiedBarista.coin_balance >= r.price && r.is_available
                  return (
                    <button
                      key={r.id}
                      onClick={() => canAfford && handleSelectReward(r)}
                      disabled={!canAfford}
                      className={`relative rounded-2xl overflow-hidden text-left transition-all duration-150 border ${
                        canAfford
                          ? 'bg-white shadow-card border-bru-light-gray hover:shadow-warm hover:border-bru-orange active:scale-95'
                          : 'bg-bru-light-gray border-transparent opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {/* Reward image */}
                      <div className="aspect-square bg-bru-parchment relative">
                        {r.image_url ? (
                          <Image src={r.image_url} alt={r.name} fill className="object-cover" sizes="160px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            {getRewardEmoji(r.name)}
                          </div>
                        )}
                        {!canAfford && r.is_available && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <span className="text-xs text-bru-warm-gray font-medium bg-white/80 px-2 py-1 rounded-full">
                              Necesitas ₿{r.price - verifiedBarista.coin_balance} más
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-bru-black leading-tight">{r.name}</p>
                        <p className={`text-sm font-semibold mt-0.5 ${canAfford ? 'text-bru-orange' : 'text-bru-warm-gray'}`}>
                          ₿{r.price}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && verifiedBarista && selectedReward && (
            <div className="p-6">
              <div className="card-warm p-6 mb-6 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden bg-bru-parchment">
                  {selectedReward.image_url ? (
                    <Image src={selectedReward.image_url} alt={selectedReward.name} width={80} height={80} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {getRewardEmoji(selectedReward.name)}
                    </div>
                  )}
                </div>
                <h3 className="font-display text-xl font-semibold mb-1">{selectedReward.name}</h3>
                {selectedReward.description && (
                  <p className="text-bru-warm-gray text-sm mb-3">{selectedReward.description}</p>
                )}
                <div className="flex items-center justify-center gap-1 text-3xl font-display font-semibold text-bru-orange">
                  ₿{selectedReward.price}
                </div>
              </div>

              <div className="bg-bru-parchment rounded-2xl p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-bru-warm-gray">Saldo actual</span>
                  <span className="font-semibold">₿{verifiedBarista.coin_balance}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-bru-warm-gray">Costo del reward</span>
                  <span className="font-semibold text-red-500">- ₿{selectedReward.price}</span>
                </div>
                <div className="border-t border-bru-light-gray pt-2 flex justify-between">
                  <span className="font-medium">Nuevo saldo</span>
                  <span className="font-semibold text-bru-orange text-lg">
                    ₿{verifiedBarista.coin_balance - selectedReward.price}
                  </span>
                </div>
              </div>

              {pinError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
                  {pinError}
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={isRedeeming}
                className="btn-orange w-full text-center disabled:opacity-60"
              >
                {isRedeeming ? 'Procesando...' : `Confirmar canje por ₿${selectedReward.price}`}
              </button>
              <button
                onClick={() => setStep('select-reward')}
                className="mt-3 w-full text-sm text-bru-warm-gray hover:text-bru-orange transition-colors text-center"
              >
                ← Cambiar recompensa
              </button>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && successData && verifiedBarista && (
            <div className="p-6 text-center">
              <div className="text-6xl mb-4 animate-bounce-coin inline-block">🎉</div>
              <h3 className="font-display text-2xl font-semibold text-bru-black mb-2">
                ¡Listo, {verifiedBarista.name}!
              </h3>
              <p className="text-bru-warm-gray mb-6">Tu reward ha sido canjeado exitosamente.</p>

              <div className="card-warm p-5 mb-6">
                <p className="text-sm text-bru-warm-gray mb-1">Canjeaste</p>
                <p className="font-display text-xl font-semibold text-bru-black mb-3">
                  {successData.rewardName}
                </p>
                <div className="border-t border-bru-light-gray pt-3">
                  <p className="text-sm text-bru-warm-gray">Nuevo saldo</p>
                  <p className="text-3xl font-display font-semibold text-bru-orange">
                    ₿{successData.newBalance}
                  </p>
                </div>
              </div>

              <p className="text-sm text-bru-warm-gray mb-6">
                El administrador ha sido notificado. Pasa a reclamar tu recompensa. 🤩
              </p>

              <button onClick={handleClose} className="btn-orange w-full">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getRewardEmoji(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('bebida')) return '☕'
  if (n.includes('postre')) return '🍰'
  if (n.includes('panini')) return '🥪'
  if (n.includes('amigo')) return '🫂'
  if (n.includes('terapia')) return '🧠'
  if (n.includes('uber') || n.includes('ride')) return '🚗'
  if (n.includes('cena')) return '🍽️'
  if (n.includes('smart') || n.includes('gym')) return '💪'
  if (n.includes('amazon') || n.includes('gift')) return '🎁'
  return '⭐'
}

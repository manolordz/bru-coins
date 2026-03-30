'use client'

import { useState } from 'react'
import Image from 'next/image'
import { RedemptionModal } from '@/components/redemption/RedemptionModal'
import { CoinRequestModal } from '@/components/CoinRequestModal'
import type { EarnRule } from '@/components/CoinRequestModal'

interface Reward {
  id: string
  name: string
  description: string | null
  image_url: string | null
  price: number
  is_available: boolean
}

interface Barista {
  id: string
  name: string
  avatar_url: string | null
  coin_balance: number
  total_coins_earned: number
  total_redeemed: number
}

interface MarketplaceSectionProps {
  rewards: Reward[]
  baristas: Barista[]
  earnRules?: EarnRule[]
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

export function MarketplaceSection({ rewards, baristas, earnRules = [] }: MarketplaceSectionProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [requestModalOpen, setRequestModalOpen] = useState(false)

  const available = rewards.filter((r) => r.is_available)
  const unavailable = rewards.filter((r) => !r.is_available)
  const allSorted = [...available, ...unavailable]

  return (
    <>
      <section className="px-4 pt-4 pb-32 sm:pt-5 sm:max-w-none">
        {/* Section header */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-display text-xl lg:text-2xl font-semibold text-bru-black">
              Marketplace
            </h2>
            <p className="text-xs lg:text-sm text-bru-warm-gray mt-0.5">
              {available.length} recompensas disponibles
            </p>
          </div>
          <span className="text-xl">🛍️</span>
        </div>

        {/* Rewards grid — 2 cols mobile, 3 cols on medium+ */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {allSorted.map((reward) => (
            <div
              key={reward.id}
              className={`rounded-2xl overflow-hidden border transition-all duration-200 ${
                reward.is_available
                  ? 'bg-white border-bru-light-gray shadow-card'
                  : 'bg-bru-light-gray/50 border-transparent opacity-60'
              }`}
            >
              {/* Image */}
              <div className="aspect-square relative bg-bru-parchment">
                {reward.image_url ? (
                  <Image
                    src={reward.image_url}
                    alt={reward.name}
                    fill
                    className={`object-cover ${!reward.is_available ? 'grayscale' : ''}`}
                    sizes="(max-width: 640px) 50vw, 200px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    {getRewardEmoji(reward.name)}
                  </div>
                )}
                {!reward.is_available && (
                  <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                    <span className="text-xs font-medium text-bru-warm-gray bg-white/90 px-2.5 py-1 rounded-full shadow-sm">
                      No disponible
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-1.5">
                  <p className="text-sm font-medium text-bru-black leading-tight line-clamp-2 flex-1">
                    {reward.name}
                  </p>
                  <p className={`font-slab text-[15px] font-bold flex-shrink-0 leading-tight tabular-nums ${
                    reward.is_available ? 'text-bru-orange' : 'text-bru-warm-gray'
                  }`}>
                    ₿{reward.price}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Floating CTAs */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-bru-parchment via-bru-parchment/95 to-transparent pointer-events-none z-30">
        <div className="flex gap-2 w-full max-w-sm mx-auto pointer-events-auto">
          <button
            onClick={() => setRequestModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white text-bru-orange font-semibold text-base py-4 px-4 rounded-2xl shadow-card border-2 border-bru-orange hover:bg-orange-50 active:scale-95 transition-all duration-150"
          >
            <span>₿</span>
            Solicitar
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex-[2] flex items-center justify-center gap-2 bg-bru-orange text-white font-semibold text-base py-4 px-6 rounded-2xl shadow-warm-lg hover:bg-bru-orange-dark active:scale-95 transition-all duration-150"
          >
            <span>🎁</span>
            Canjear Reward
          </button>
        </div>
      </div>

      {/* Redemption modal */}
      <RedemptionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        baristas={baristas}
        rewards={rewards}
      />

      {/* Coin request modal */}
      <CoinRequestModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        baristas={baristas}
        earnRules={earnRules}
      />
    </>
  )
}

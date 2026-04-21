'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { CoinModal } from '@/components/admin/CoinModal'
import { updateBarista, createBarista } from '@/lib/actions/admin'

interface Barista {
  id: string
  name: string
  avatar_url: string | null
  coin_balance: number
  total_coins_earned: number
  total_redeemed: number
  is_active: boolean
}

export default function BaristasPage() {
  const [baristas, setBaristas] = useState<Barista[]>([])
  const [loading, setLoading] = useState(true)
  const [coinModal, setCoinModal] = useState<{ barista: Barista; mode: 'add' | 'deduct' } | null>(null)
  const [editModal, setEditModal] = useState<Barista | null>(null)
  const [addModal, setAddModal] = useState(false)
  const supabase = createClient()

  const fetchBaristas = async () => {
    const { data } = await supabase
      .from('baristas')
      .select('id, name, avatar_url, coin_balance, total_coins_earned, total_redeemed, is_active')
      .order('coin_balance', { ascending: false })
    setBaristas(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchBaristas() }, [])

  const handleToggleActive = async (b: Barista) => {
    await updateBarista(b.id, { is_active: !b.is_active })
    fetchBaristas()
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-bru-black">Baristas</h1>
          <p className="text-bru-warm-gray text-sm mt-0.5">{baristas.filter(b => b.is_active).length} activos</p>
        </div>
        <button
          onClick={() => setAddModal(true)}
          className="btn-orange text-sm py-2.5 px-4"
        >
          + Agregar barista
        </button>
      </div>

      {/* Barista list */}
      <div className="space-y-3">
        {baristas.map((b) => (
          <div
            key={b.id}
            className={`card-warm p-4 transition-opacity ${!b.is_active ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-4">
              <Avatar name={b.name} avatarUrl={b.avatar_url} size="md" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-bru-black">{b.name}</p>
                  {!b.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-bru-warm-gray">
                  <span>₿{b.total_coins_earned} ganadas</span>
                  <span>·</span>
                  <span>{b.total_redeemed} canjes</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`font-display text-xl font-bold ${b.coin_balance < 0 ? 'text-red-600' : 'text-bru-orange'}`}>
                  {b.coin_balance < 0 ? `-₿${Math.abs(b.coin_balance)}` : `₿${b.coin_balance}`}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-bru-light-gray flex-wrap">
              <button
                onClick={() => setCoinModal({ barista: b, mode: 'add' })}
                disabled={!b.is_active}
                className="flex-1 text-xs font-medium py-2 px-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Agregar ₿
              </button>
              <button
                onClick={() => setCoinModal({ barista: b, mode: 'deduct' })}
                disabled={!b.is_active}
                className="flex-1 text-xs font-medium py-2 px-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                − Quitar ₿
              </button>
              <button
                onClick={() => setEditModal(b)}
                className="text-xs font-medium py-2 px-3 rounded-lg bg-bru-parchment text-bru-black hover:bg-bru-light-gray border border-bru-light-gray transition-colors"
              >
                ✏️ Editar
              </button>
              <button
                onClick={() => handleToggleActive(b)}
                className={`text-xs font-medium py-2 px-3 rounded-lg border transition-colors ${
                  b.is_active
                    ? 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                    : 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200'
                }`}
              >
                {b.is_active ? 'Desactivar' : 'Reactivar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Coin modal */}
      {coinModal && (
        <CoinModal
          barista={coinModal.barista}
          mode={coinModal.mode}
          onClose={() => setCoinModal(null)}
          onSuccess={fetchBaristas}
        />
      )}

      {/* Edit modal */}
      {editModal && (
        <BaristaEditModal
          barista={editModal}
          onClose={() => setEditModal(null)}
          onSuccess={() => { setEditModal(null); fetchBaristas() }}
        />
      )}

      {/* Add modal */}
      {addModal && (
        <BaristaAddModal
          onClose={() => setAddModal(false)}
          onSuccess={() => { setAddModal(false); fetchBaristas() }}
        />
      )}
    </div>
  )
}

// ─── Edit Barista Modal ──────────────────────────────────────────────────────

function BaristaEditModal({
  barista,
  onClose,
  onSuccess,
}: {
  barista: Barista
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(barista.name)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(barista.avatar_url)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setAvatarFile(f)
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (pin && !/^\d{4}$/.test(pin)) return setError('El PIN debe ser de 4 dígitos.')

    startTransition(async () => {
      // Upload avatar if changed
      let avatarUrl = barista.avatar_url
      if (avatarFile) {
        const supabase = createClient()
        const ext = avatarFile.name.split('.').pop()
        const path = `avatars/${barista.id}.${ext}`
        const { error: upErr } = await supabase.storage.from('bru-assets').upload(path, avatarFile, { upsert: true })
        if (!upErr) {
          const { data } = supabase.storage.from('bru-assets').getPublicUrl(path)
          avatarUrl = data.publicUrl
        }
      }

      const result = await updateBarista(barista.id, {
        name,
        ...(pin ? { pin } : {}),
        ...(avatarUrl !== barista.avatar_url ? { avatar_url: avatarUrl ?? undefined } : {}),
      })
      if (result.error) setError(result.error)
      else onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-warm-lg animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-bru-light-gray">
          <h2 className="font-display text-xl font-semibold">Editar barista</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bru-light-gray flex items-center justify-center text-lg">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div onClick={() => fileRef.current?.click()} className="cursor-pointer relative">
              <Avatar name={name || barista.name} avatarUrl={avatarPreview} size="xl" />
              <div className="absolute inset-0 rounded-full bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-white text-sm">📷</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-bru-black">Foto de perfil</p>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-bru-orange hover:underline mt-0.5">
                Cambiar foto
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">Nombre</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-warm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">
              Nuevo PIN <span className="text-bru-warm-gray font-normal">(dejar vacío para no cambiar)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4 dígitos"
              className="input-warm tracking-widest text-lg"
            />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
          <button type="submit" disabled={isPending} className="btn-orange w-full disabled:opacity-60">
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Add Barista Modal ───────────────────────────────────────────────────────

function BaristaAddModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.target as HTMLFormElement)
    const pin = fd.get('pin') as string
    if (pin && !/^\d{4}$/.test(pin)) return setError('El PIN debe ser de 4 dígitos.')

    startTransition(async () => {
      const result = await createBarista(fd)
      if (result.error) setError(result.error)
      else onSuccess()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-warm-lg animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-bru-light-gray">
          <h2 className="font-display text-xl font-semibold">Nuevo barista</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bru-light-gray flex items-center justify-center text-lg">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">Nombre</label>
            <input name="name" type="text" className="input-warm" placeholder="Nombre del barista" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">
              PIN inicial <span className="text-bru-warm-gray font-normal">(opcional)</span>
            </label>
            <input
              name="pin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="4 dígitos"
              className="input-warm tracking-widest text-lg"
            />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
          <button type="submit" disabled={isPending} className="btn-orange w-full disabled:opacity-60">
            {isPending ? 'Creando...' : 'Crear barista'}
          </button>
        </form>
      </div>
    </div>
  )
}

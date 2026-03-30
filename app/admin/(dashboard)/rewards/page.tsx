'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { createReward, updateReward, uploadImageToStorage } from '@/lib/actions/admin'

interface Reward {
  id: string
  name: string
  description: string | null
  image_url: string | null
  price: number
  is_available: boolean
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

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState<Reward | null>(null)
  const [addModal, setAddModal] = useState(false)
  const supabase = createClient()

  const fetchRewards = async () => {
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .order('price', { ascending: true })
    setRewards(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchRewards() }, [])

  const handleToggle = async (r: Reward) => {
    await updateReward(r.id, { is_available: !r.is_available })
    fetchRewards()
  }

  if (loading) return (
    <div className="p-6 animate-pulse grid grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-white rounded-2xl" />)}
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-bru-black">Rewards</h1>
          <p className="text-bru-warm-gray text-sm mt-0.5">{rewards.filter(r => r.is_available).length} disponibles</p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn-orange text-sm py-2.5 px-4">
          + Agregar reward
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {rewards.map((r) => (
          <div
            key={r.id}
            className={`card-warm overflow-hidden transition-opacity ${!r.is_available ? 'opacity-60' : ''}`}
          >
            {/* Image */}
            <div className="aspect-square bg-bru-parchment relative">
              {r.image_url ? (
                <Image src={r.image_url} alt={r.name} fill className="object-cover" sizes="200px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">
                  {getRewardEmoji(r.name)}
                </div>
              )}
              {!r.is_available && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                  <span className="text-xs bg-white/90 text-gray-500 px-2 py-1 rounded-full font-medium">
                    No disponible
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3 pb-2">
              <div className="flex items-start justify-between gap-1.5">
                <p className="text-sm font-semibold text-bru-black leading-tight line-clamp-2 flex-1">{r.name}</p>
                <p className="font-slab text-[15px] font-bold text-bru-orange flex-shrink-0 leading-tight tabular-nums">
                  ₿{r.price}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-3 pb-3 flex items-center gap-2">
              <button
                onClick={() => setEditModal(r)}
                className="flex-1 text-xs py-1.5 rounded-lg bg-bru-parchment border border-bru-light-gray hover:border-bru-orange hover:text-bru-orange transition-colors"
              >
                ✏️ Editar
              </button>
              {/* Toggle switch */}
              <button
                onClick={() => handleToggle(r)}
                title={r.is_available ? 'Desactivar reward' : 'Activar reward'}
                className={`flex items-center gap-1.5 text-xs font-medium py-1.5 px-2.5 rounded-lg border transition-all ${
                  r.is_available
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {/* pill track */}
                <span className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors duration-200 ${
                  r.is_available ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    r.is_available ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </span>
                <span className="leading-none">{r.is_available ? 'Activa' : 'Inactiva'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {editModal && (
        <RewardModal
          reward={editModal}
          onClose={() => setEditModal(null)}
          onSuccess={() => { setEditModal(null); fetchRewards() }}
        />
      )}

      {addModal && (
        <RewardModal
          onClose={() => setAddModal(false)}
          onSuccess={() => { setAddModal(false); fetchRewards() }}
        />
      )}
    </div>
  )
}

// ─── Reward Form Modal ───────────────────────────────────────────────────────

function RewardModal({
  reward,
  onClose,
  onSuccess,
}: {
  reward?: Reward
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!reward
  const [name, setName] = useState(reward?.name || '')
  const [description, setDescription] = useState(reward?.description || '')
  const [price, setPrice] = useState(reward?.price ? String(reward.price) : '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(reward?.image_url || null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('El nombre es requerido.')
    if (!price || parseInt(price) <= 0) return setError('El precio debe ser mayor a 0.')

    startTransition(async () => {
      let imageUrl = reward?.image_url || null

      // ── Helper: upload image via service-role server action ────────────────
      const uploadImage = async (rewardId: string): Promise<string | null> => {
        if (!imageFile) return imageUrl
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const fd = new FormData()
        fd.append('file', imageFile)
        fd.append('path', `rewards/${rewardId}.${ext}`)
        const result = await uploadImageToStorage(fd)
        if (result.error) { setError(result.error); return null }
        return result.url ?? null
      }

      if (isEdit) {
        // Upload image first (if new file selected)
        const uploadedUrl = await uploadImage(reward!.id)
        if (imageFile && uploadedUrl === null) return  // upload failed, error already set

        const result = await updateReward(reward!.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          price: parseInt(price),
          image_url: uploadedUrl ?? undefined,
        })
        if (result.error) setError(result.error)
        else onSuccess()
      } else {
        // Create reward first to get its real ID, then upload image
        const createResult = await createReward({
          name: name.trim(),
          description: description.trim() || undefined,
          price: parseInt(price),
        })
        if (createResult.error) { setError(createResult.error); return }

        if (imageFile && createResult.id) {
          const uploadedUrl = await uploadImage(createResult.id)
          if (uploadedUrl) {
            await updateReward(createResult.id, { image_url: uploadedUrl })
          }
        }
        onSuccess()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-warm-lg animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-bru-light-gray sticky top-0 bg-white">
          <h2 className="font-display text-xl font-semibold">{isEdit ? 'Editar reward' : 'Nuevo reward'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bru-light-gray flex items-center justify-center text-lg">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">Imagen</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer w-full aspect-video rounded-2xl overflow-hidden bg-bru-parchment border-2 border-dashed border-bru-light-gray hover:border-bru-orange transition-colors flex items-center justify-center relative"
            >
              {imagePreview ? (
                <Image src={imagePreview} alt="Preview" fill className="object-cover" sizes="400px" />
              ) : (
                <div className="text-center text-bru-warm-gray">
                  <div className="text-3xl mb-1">📷</div>
                  <p className="text-sm">Toca para subir imagen</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">Nombre <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-warm" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">Descripción <span className="text-bru-warm-gray font-normal">(opcional)</span></label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-warm" placeholder="Breve descripción..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">Precio en ₿ <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-slab text-lg font-semibold text-bru-orange select-none pointer-events-none">₿</span>
              <input
                type="number"
                min="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="input-warm pl-10 text-xl font-slab font-semibold tabular-nums"
                required
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-xl">{error}</p>}

          <button type="submit" disabled={isPending} className="btn-orange w-full disabled:opacity-60">
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear reward'}
          </button>
        </form>
      </div>
    </div>
  )
}

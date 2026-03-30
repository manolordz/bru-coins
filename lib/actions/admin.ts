'use server'

import bcrypt from 'bcryptjs'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function adminSignIn(email: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Credenciales incorrectas. Inténtalo de nuevo.' }

  // Verify this user is in the admins table
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Error de autenticación.' }

  const service = createServiceClient()
  const { data: admin } = await service
    .from('admins')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!admin) {
    await supabase.auth.signOut()
    return { error: 'No tienes permisos de administrador.' }
  }

  return { success: true }
}

export async function adminSignOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}

// ─── Baristas ────────────────────────────────────────────────────────────────

export async function createBarista(formData: FormData) {
  const supabase = createServiceClient()
  const name = formData.get('name') as string
  const pin = formData.get('pin') as string

  if (!name?.trim()) return { error: 'El nombre es requerido.' }
  if (pin && !/^\d{4}$/.test(pin)) return { error: 'El PIN debe ser de 4 dígitos.' }

  const hashedPin = pin ? await bcrypt.hash(pin, 10) : null

  const { error } = await supabase.from('baristas').insert({
    name: name.trim(),
    pin: hashedPin,
  })

  if (error) return { error: 'Error al crear el barista.' }
  revalidatePath('/admin/baristas')
  return { success: true }
}

export async function updateBarista(
  id: string,
  data: { name?: string; pin?: string; avatar_url?: string; is_active?: boolean }
) {
  const supabase = createServiceClient()
  const updates: Record<string, unknown> = {}

  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url
  if (data.is_active !== undefined) updates.is_active = data.is_active

  if (data.pin !== undefined) {
    if (!/^\d{4}$/.test(data.pin)) return { error: 'El PIN debe ser de 4 dígitos numéricos.' }
    updates.pin = await bcrypt.hash(data.pin, 10)
  }

  const { error } = await supabase.from('baristas').update(updates).eq('id', id)
  if (error) return { error: 'Error al actualizar el barista.' }

  revalidatePath('/admin/baristas')
  revalidatePath('/')
  return { success: true }
}

export async function uploadBaristaAvatar(id: string, file: File) {
  const supabase = createServiceClient()

  const ext = file.name.split('.').pop()
  const path = `avatars/${id}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('bru-assets')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: 'Error al subir el avatar.' }

  const { data: urlData } = supabase.storage
    .from('bru-assets')
    .getPublicUrl(path)

  await updateBarista(id, { avatar_url: urlData.publicUrl })
  return { success: true, url: urlData.publicUrl }
}

// ─── Coin Management ─────────────────────────────────────────────────────────

export async function addCoins(baristaId: string, amount: number, reason: string) {
  if (amount <= 0) return { error: 'La cantidad debe ser mayor a 0.' }
  if (!reason?.trim()) return { error: 'El motivo es requerido.' }

  const supabase = createServiceClient()

  const { error } = await supabase.rpc('add_coins', {
    p_barista_id: baristaId,
    p_amount: amount,
    p_reason: reason.trim(),
  })

  if (error) return { error: 'Error al agregar monedas.' }

  revalidatePath('/admin/baristas')
  revalidatePath('/')
  return { success: true }
}

export async function deductCoins(baristaId: string, amount: number, reason: string) {
  if (amount <= 0) return { error: 'La cantidad debe ser mayor a 0.' }
  if (!reason?.trim()) return { error: 'El motivo es requerido.' }

  const supabase = createServiceClient()

  // Check current balance first
  const { data: barista } = await supabase
    .from('baristas')
    .select('coin_balance, name')
    .eq('id', baristaId)
    .single()

  if (!barista) return { error: 'Barista no encontrado.' }
  if (barista.coin_balance < amount) {
    return { error: `Saldo insuficiente. ${barista.name} tiene ₿${barista.coin_balance}.` }
  }

  const { error } = await supabase.rpc('deduct_coins', {
    p_barista_id: baristaId,
    p_amount: amount,
    p_reason: reason.trim(),
  })

  if (error) return { error: 'Error al quitar monedas.' }

  revalidatePath('/admin/baristas')
  revalidatePath('/')
  return { success: true }
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

export async function createReward(data: {
  name: string
  description?: string
  price: number
  image_url?: string
}) {
  if (!data.name?.trim()) return { error: 'El nombre es requerido.' }
  if (!data.price || data.price <= 0) return { error: 'El precio debe ser mayor a 0.' }

  const supabase = createServiceClient()
  const { data: row, error } = await supabase
    .from('rewards')
    .insert({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price: data.price,
      image_url: data.image_url || null,
      is_available: true,
    })
    .select('id')
    .single()

  if (error || !row) return { error: 'Error al crear la recompensa.' }
  revalidatePath('/admin/rewards')
  revalidatePath('/')
  return { success: true, id: row.id as string }
}

/**
 * Upload an image file to Supabase Storage using the service-role client
 * (bypasses RLS — safe because this is called from admin Server Actions only).
 * Returns the public URL on success.
 */
export async function uploadImageToStorage(formData: FormData) {
  const file = formData.get('file') as File | null
  const path = formData.get('path') as string | null

  if (!file || !path) return { error: 'Faltan archivo o ruta.' }

  const supabase = createServiceClient()
  const { error: upErr } = await supabase.storage
    .from('bru-assets')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (upErr) {
    console.error('[storage] Upload error:', upErr)
    return { error: `Error al subir imagen: ${upErr.message}` }
  }

  const { data } = supabase.storage.from('bru-assets').getPublicUrl(path)
  return { success: true, url: data.publicUrl }
}

export async function updateReward(id: string, data: {
  name?: string
  description?: string
  price?: number
  image_url?: string
  is_available?: boolean
}) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('rewards').update(data).eq('id', id)
  if (error) return { error: 'Error al actualizar la recompensa.' }
  revalidatePath('/admin/rewards')
  revalidatePath('/')
  return { success: true }
}

export async function uploadRewardImage(rewardId: string, file: File) {
  const supabase = createServiceClient()
  const ext = file.name.split('.').pop()
  const path = `rewards/${rewardId}.${ext}`

  const { error } = await supabase.storage
    .from('bru-assets')
    .upload(path, file, { upsert: true })

  if (error) return { error: 'Error al subir la imagen.' }

  const { data: urlData } = supabase.storage
    .from('bru-assets')
    .getPublicUrl(path)

  await updateReward(rewardId, { image_url: urlData.publicUrl })
  return { success: true, url: urlData.publicUrl }
}

// ─── Coin Rules ───────────────────────────────────────────────────────────────

export async function createCoinRule(data: {
  type: 'earn' | 'deduct'
  description: string
  amount: number
  sort_order?: number
}) {
  if (!data.description?.trim()) return { error: 'La descripción es requerida.' }
  if (data.amount < 0) return { error: 'El monto no puede ser negativo.' }
  const supabase = createServiceClient()
  const { error } = await supabase.from('coin_rules').insert({
    type: data.type,
    description: data.description.trim(),
    amount: data.amount,
    sort_order: data.sort_order ?? 0,
  })
  if (error) return { error: 'Error al crear la regla.' }
  revalidatePath('/admin/reglas')
  revalidatePath('/')
  return { success: true }
}

export async function updateCoinRule(id: string, data: {
  description?: string
  amount?: number
  sort_order?: number
  is_active?: boolean
}) {
  const supabase = createServiceClient()
  const updates: Record<string, unknown> = {}
  if (data.description !== undefined) updates.description = data.description.trim()
  if (data.amount !== undefined) updates.amount = data.amount
  if (data.sort_order !== undefined) updates.sort_order = data.sort_order
  if (data.is_active !== undefined) updates.is_active = data.is_active
  const { error } = await supabase.from('coin_rules').update(updates).eq('id', id)
  if (error) return { error: 'Error al actualizar la regla.' }
  revalidatePath('/admin/reglas')
  revalidatePath('/')
  return { success: true }
}

export async function deleteCoinRule(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('coin_rules').delete().eq('id', id)
  if (error) return { error: 'Error al eliminar la regla.' }
  revalidatePath('/admin/reglas')
  revalidatePath('/')
  return { success: true }
}

// ─── Coin Requests ────────────────────────────────────────────────────────────

interface RequestItem {
  ruleId: string
  description: string
  amount: number
  quantity: number
  subtotal: number
}

export async function approveCoinRequest(requestId: string) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  const supabase = createServiceClient()

  const { data: request } = await supabase
    .from('coin_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!request || request.status !== 'pending') {
    return { error: 'Solicitud no encontrada o ya procesada.' }
  }

  const items = request.items as RequestItem[]
  const reason = `Solicitud aprobada: ${items
    .map(i => `${i.description}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
    .join(', ')}`

  const { error: coinsError } = await supabase.rpc('add_coins', {
    p_barista_id: request.barista_id,
    p_amount: request.total_amount,
    p_reason: reason,
  })
  if (coinsError) return { error: 'Error al agregar coins.' }

  await supabase
    .from('coin_requests')
    .update({ status: 'approved', reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  revalidatePath('/admin/solicitudes')
  revalidatePath('/')
  return { success: true }
}

export async function rejectCoinRequest(requestId: string) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('coin_requests')
    .update({ status: 'rejected', reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  if (error) return { error: 'Error al rechazar la solicitud.' }
  revalidatePath('/admin/solicitudes')
  return { success: true }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings() {
  const supabase = createServiceClient()
  const { data } = await supabase.from('app_settings').select('key, value')
  const settings: Record<string, string> = {}
  data?.forEach(({ key, value }) => { if (value) settings[key] = value })
  return settings
}

export async function saveSettings(settings: Record<string, string>) {
  const supabase = createServiceClient()
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('app_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) return { error: 'Error al guardar la configuración.' }
  return { success: true }
}

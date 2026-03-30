'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { approveCoinRequest, rejectCoinRequest } from '@/lib/actions/admin'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface RequestItem {
  ruleId: string
  description: string
  amount: number
  quantity: number
  subtotal: number
}

interface CoinRequest {
  id: string
  barista_id: string
  items: RequestItem[]
  total_amount: number
  status: 'pending' | 'approved' | 'rejected'
  reviewed_at: string | null
  created_at: string
  baristas: { name: string; avatar_url: string | null } | null
}

const STATUS_LABEL = {
  pending:  { text: 'Pendiente', bg: 'bg-yellow-100 text-yellow-800' },
  approved: { text: 'Aprobada',  bg: 'bg-green-100 text-green-800'  },
  rejected: { text: 'Rechazada', bg: 'bg-red-100 text-red-800'      },
}

export default function SolicitudesPage() {
  const [requests, setRequests] = useState<CoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const supabase = createClient()

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('coin_requests')
      .select('*, baristas(name, avatar_url)')
      .order('created_at', { ascending: false })
    setRequests((data as CoinRequest[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()

    // Realtime: refresh when requests change
    const channel = supabase
      .channel('coin-requests-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_requests' }, () => {
        fetchRequests()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  if (loading) return (
    <div className="p-6 lg:p-8 animate-pulse space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white rounded-2xl" />)}
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-bru-black flex items-center gap-2">
            Solicitudes de ₿
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-bru-warm-gray text-sm mt-0.5">
            Revisa y aprueba las solicitudes de coins de tu equipo.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-none pb-1">
        {(['pending', 'all', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 text-sm font-medium px-4 py-1.5 rounded-full border transition-all ${
              filter === f
                ? 'bg-bru-orange text-white border-bru-orange'
                : 'bg-white text-bru-warm-gray border-bru-light-gray hover:border-bru-orange hover:text-bru-orange'
            }`}
          >
            {f === 'all'      ? 'Todas'     : ''}
            {f === 'pending'  ? `Pendientes${pendingCount > 0 ? ` (${pendingCount})` : ''}` : ''}
            {f === 'approved' ? 'Aprobadas' : ''}
            {f === 'rejected' ? 'Rechazadas': ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-bru-warm-gray">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-medium">Sin solicitudes {filter !== 'all' ? STATUS_LABEL[filter]?.text.toLowerCase() + 's' : ''}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((req) => (
          <RequestCard key={req.id} req={req} onRefresh={fetchRequests} />
        ))}
      </div>
    </div>
  )
}

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({ req, onRefresh }: { req: CoinRequest; onRefresh: () => void }) {
  const [isPending, startTransition] = useTransition()
  const status = STATUS_LABEL[req.status]
  const isPendingStatus = req.status === 'pending'

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveCoinRequest(req.id)
      if (!result.error) onRefresh()
    })
  }

  const handleReject = () => {
    if (!confirm('¿Rechazar esta solicitud?')) return
    startTransition(async () => {
      const result = await rejectCoinRequest(req.id)
      if (!result.error) onRefresh()
    })
  }

  return (
    <div className={`card-warm overflow-hidden transition-opacity ${!isPendingStatus ? 'opacity-75' : ''}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-bru-light-gray">
        <div className="flex items-center gap-3">
          <Avatar
            name={req.baristas?.name || '?'}
            avatarUrl={req.baristas?.avatar_url || null}
            size="sm"
          />
          <div>
            <p className="font-semibold text-sm text-bru-black">{req.baristas?.name || 'Barista'}</p>
            <p className="text-xs text-bru-warm-gray">
              {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: es })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.bg}`}>
            {status.text}
          </span>
          <span className="font-slab text-base font-bold text-bru-orange">+₿{req.total_amount}</span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-1.5">
        {req.items.map((item, i) => (
          <div key={i} className="flex items-baseline justify-between text-sm">
            <span className="text-bru-black flex-1 truncate">{item.description}</span>
            <span className="text-bru-warm-gray text-xs ml-2 flex-shrink-0">
              {item.quantity > 1 ? `×${item.quantity} ` : ''}
            </span>
            <span className="font-slab font-semibold text-green-700 ml-1 flex-shrink-0">+₿{item.subtotal}</span>
          </div>
        ))}
      </div>

      {/* Approve / Reject for pending */}
      {isPendingStatus && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={handleReject}
            disabled={isPending}
            className="flex-1 py-2 text-sm font-semibold rounded-xl border-2 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            ✕ Rechazar
          </button>
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1 py-2 text-sm font-semibold rounded-xl bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Procesando...' : '✓ Aprobar +₿' + req.total_amount}
          </button>
        </div>
      )}
    </div>
  )
}

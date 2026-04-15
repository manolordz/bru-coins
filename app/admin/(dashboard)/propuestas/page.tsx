'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { markProposalReviewed, updateProposalNotes } from '@/lib/actions/admin'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

type ProposalStatus = 'pending' | 'reviewed'

interface Proposal {
  id: string
  idea_type: 'nueva_recompensa' | 'idea_mejora' | 'otro'
  message: string
  status: ProposalStatus
  admin_notes: string | null
  created_at: string
  baristas: { name: string; avatar_url: string | null }
}

const IDEA_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  nueva_recompensa: { label: 'Nueva Recompensa', color: 'bg-blue-100 text-blue-700',   emoji: '🎁' },
  idea_mejora:      { label: 'Idea de Mejora',   color: 'bg-purple-100 text-purple-700', emoji: '🔧' },
  otro:             { label: 'Otro Comentario',  color: 'bg-gray-100 text-gray-600',    emoji: '💬' },
}

type Filter = 'all' | 'pending' | 'reviewed'

export default function PropuestasPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<Filter>('pending')
  const [notesModal, setNotesModal] = useState<Proposal | null>(null)
  const supabase = createClient()

  const fetchProposals = async () => {
    const { data } = await supabase
      .from('proposals')
      .select('id, idea_type, message, status, admin_notes, created_at, baristas(name, avatar_url)')
      .order('created_at', { ascending: false })
    setProposals((data as unknown as Proposal[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProposals()

    const channel = supabase
      .channel('proposals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () => {
        fetchProposals()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = proposals.filter(p => {
    if (filter === 'all') return true
    return p.status === filter
  })

  const pendingCount = proposals.filter(p => p.status === 'pending').length

  if (loading) {
    return (
      <div className="p-4 lg:p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-bru-black flex items-center gap-2">
            Propuestas 💡
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-bru-warm-gray text-sm mt-0.5">{proposals.length} propuestas en total</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 bg-white rounded-xl p-1.5 shadow-card border border-bru-light-gray">
        {(['pending', 'all', 'reviewed'] as Filter[]).map((f) => {
          const labels: Record<Filter, string> = { pending: '⏳ Pendientes', all: '📋 Todas', reviewed: '✅ Revisadas' }
          const counts: Record<Filter, number> = {
            pending: proposals.filter(p => p.status === 'pending').length,
            all: proposals.length,
            reviewed: proposals.filter(p => p.status === 'reviewed').length,
          }
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all ${
                filter === f ? 'bg-bru-orange text-white shadow-sm' : 'text-bru-warm-gray hover:text-bru-black'
              }`}
            >
              {labels[f]} <span className="ml-1 opacity-70">({counts[f]})</span>
            </button>
          )
        })}
      </div>

      {/* Proposals list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-bru-warm-gray">
          <div className="text-4xl mb-3">💡</div>
          <p className="font-medium">No hay propuestas {filter !== 'all' ? `con estado "${filter === 'pending' ? 'pendiente' : 'revisada'}"` : 'aún'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onReviewed={fetchProposals}
              onOpenNotes={() => setNotesModal(p)}
            />
          ))}
        </div>
      )}

      {notesModal && (
        <NotesModal
          proposal={notesModal}
          onClose={() => setNotesModal(null)}
          onSaved={() => { setNotesModal(null); fetchProposals() }}
        />
      )}
    </div>
  )
}

// ─── Proposal Card ────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  onReviewed,
  onOpenNotes,
}: {
  proposal: Proposal
  onReviewed: () => void
  onOpenNotes: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const meta = IDEA_LABELS[proposal.idea_type]
  const isPendingStatus = proposal.status === 'pending'

  const handleMarkReviewed = () => {
    startTransition(async () => {
      await markProposalReviewed(proposal.id)
      onReviewed()
    })
  }

  return (
    <div className={`card-warm p-4 transition-opacity ${!isPendingStatus ? 'opacity-70' : ''}`}>
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar
          name={proposal.baristas.name}
          avatarUrl={proposal.baristas.avatar_url}
          size="sm"
          className="flex-shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-bru-black">{proposal.baristas.name}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
              {meta.emoji} {meta.label}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-auto ${
              isPendingStatus ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
            }`}>
              {isPendingStatus ? '⏳ Pendiente' : '✅ Revisada'}
            </span>
          </div>
          <p className="text-xs text-bru-warm-gray mt-0.5">
            {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true, locale: es })}
          </p>
        </div>
      </div>

      {/* Message */}
      <p className="text-sm text-bru-black leading-relaxed bg-bru-parchment/60 rounded-xl px-3 py-2.5 mb-3">
        {proposal.message}
      </p>

      {/* Admin notes */}
      {proposal.admin_notes && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs font-semibold text-blue-700 mb-0.5">Nota interna</p>
          <p className="text-xs text-blue-900">{proposal.admin_notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isPendingStatus && (
          <button
            onClick={handleMarkReviewed}
            disabled={isPending}
            className="flex-1 text-xs font-medium py-2 px-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-40"
          >
            {isPending ? 'Guardando...' : '✅ Marcar revisada'}
          </button>
        )}
        <button
          onClick={onOpenNotes}
          className="text-xs font-medium py-2 px-3 rounded-lg bg-bru-parchment text-bru-black hover:bg-bru-light-gray border border-bru-light-gray transition-colors"
        >
          📝 {proposal.admin_notes ? 'Editar nota' : 'Agregar nota'}
        </button>
      </div>
    </div>
  )
}

// ─── Notes Modal ─────────────────────────────────────────────────────────────

function NotesModal({
  proposal,
  onClose,
  onSaved,
}: {
  proposal: Proposal
  onClose: () => void
  onSaved: () => void
}) {
  const [notes, setNotes]             = useState(proposal.admin_notes || '')
  const [isPending, startTransition]  = useTransition()
  const [markReviewed, setMarkReviewed] = useState(false)

  const handleSave = () => {
    startTransition(async () => {
      await updateProposalNotes(proposal.id, notes)
      if (markReviewed && proposal.status === 'pending') {
        await markProposalReviewed(proposal.id)
      }
      onSaved()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-warm-lg animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-bru-light-gray">
          <h2 className="font-display text-lg font-semibold">Nota interna</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bru-light-gray flex items-center justify-center text-lg">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-bru-warm-gray mb-1 font-medium">Propuesta de {proposal.baristas.name}</p>
            <p className="text-sm text-bru-black bg-bru-parchment/60 rounded-xl px-3 py-2 leading-relaxed line-clamp-3">
              {proposal.message}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-bru-black mb-1.5">Nota interna (solo visible para admins)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ej: Discutir en la reunión del lunes..."
              className="input-warm resize-none"
            />
          </div>
          {proposal.status === 'pending' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={markReviewed}
                onChange={(e) => setMarkReviewed(e.target.checked)}
                className="w-4 h-4 accent-bru-orange"
              />
              <span className="text-sm text-bru-black">Marcar como revisada al guardar</span>
            </label>
          )}
          <button onClick={handleSave} disabled={isPending} className="btn-orange w-full disabled:opacity-60">
            {isPending ? 'Guardando...' : 'Guardar nota'}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Transaction {
  id: string
  barista_id: string
  type: 'earn' | 'deduct'
  amount: number
  reason: string
  created_by: string
  created_at: string
  baristas?: { name: string } | null
}

interface Barista {
  id: string
  name: string
}

export default function TransaccionesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [baristas, setBaristas] = useState<Barista[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBarista, setFilterBarista] = useState('')
  const [filterType, setFilterType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('baristas')
      .select('id, name')
      .order('name')
      .then(({ data }) => setBaristas(data || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*, baristas(name)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (filterBarista) query = query.eq('barista_id', filterBarista)
    if (filterType) query = query.eq('type', filterType)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')

    query.then(({ data }) => {
      setTransactions((data as Transaction[]) || [])
      setLoading(false)
    })
  }, [filterBarista, filterType, dateFrom, dateTo])

  const total = transactions.reduce((acc, t) => {
    if (t.type === 'earn') return acc + t.amount
    return acc - t.amount
  }, 0)

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-bru-black">Transacciones</h1>
        <p className="text-bru-warm-gray text-sm mt-0.5">Historial completo de movimientos</p>
      </div>

      {/* Filters */}
      <div className="card-warm p-4 mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <select
          value={filterBarista}
          onChange={(e) => setFilterBarista(e.target.value)}
          className="input-warm text-sm"
        >
          <option value="">Todos los baristas</option>
          {baristas.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input-warm text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="earn">Ganó ₿</option>
          <option value="deduct">Perdió ₿</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input-warm text-sm"
          placeholder="Desde"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input-warm text-sm"
          placeholder="Hasta"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card-warm p-4 text-center">
          <p className="text-xs text-bru-warm-gray mb-1">Total movimientos</p>
          <p className="font-display text-2xl font-bold text-bru-black">{transactions.length}</p>
        </div>
        <div className="card-warm p-4 text-center bg-green-50 border-green-100">
          <p className="text-xs text-green-600 mb-1">Total ganado</p>
          <p className="font-display text-2xl font-bold text-green-700">
            ₿{transactions.filter(t => t.type === 'earn').reduce((s, t) => s + t.amount, 0)}
          </p>
        </div>
        <div className="card-warm p-4 text-center bg-red-50 border-red-100">
          <p className="text-xs text-red-600 mb-1">Total deducido</p>
          <p className="font-display text-2xl font-bold text-red-700">
            ₿{transactions.filter(t => t.type === 'deduct').reduce((s, t) => s + t.amount, 0)}
          </p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-white rounded-xl" />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="card-warm p-12 text-center text-bru-warm-gray">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-medium">Sin transacciones</p>
          <p className="text-sm mt-1">No hay movimientos para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="card-warm px-4 py-3 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${
                tx.type === 'earn' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {tx.type === 'earn' ? '+' : '−'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-bru-black text-sm">{tx.baristas?.name || '—'}</p>
                  <span className={`font-display font-bold text-base ${
                    tx.type === 'earn' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {tx.type === 'earn' ? '+' : '−'}₿{tx.amount}
                  </span>
                </div>
                <p className="text-xs text-bru-warm-gray mt-0.5 truncate">{tx.reason}</p>
                <p className="text-xs text-bru-warm-gray/70 mt-0.5">
                  {format(new Date(tx.created_at), 'dd MMM yyyy · HH:mm', { locale: es })}
                  {' · '}
                  {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: es })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

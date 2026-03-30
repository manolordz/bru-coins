'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { adminSignIn } from '@/lib/actions/admin'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await adminSignIn(email, password)
      if (result?.error) {
        setError(result.error)
      } else {
        router.push('/admin/baristas')
        router.refresh()
      }
    })
  }

  return (
    <div className="min-h-screen bg-bru-parchment flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">☕</div>
          <h1 className="font-display text-3xl font-bold text-bru-black">BRÜ Coins</h1>
          <p className="text-bru-warm-gray text-sm mt-1">Panel de Administración</p>
        </div>

        {/* Card */}
        <div className="card-warm p-6">
          <h2 className="font-display text-xl font-semibold text-bru-black mb-5">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-bru-black mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@bru.com"
                className="input-warm"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bru-black mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-warm"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="btn-orange w-full disabled:opacity-60"
            >
              {isPending ? 'Entrando...' : 'Entrar al panel'}
            </button>
          </form>

          <p className="text-center text-xs text-bru-warm-gray mt-5">
            Solo para administradores de BRÜ
          </p>
        </div>

        <div className="text-center mt-4">
          <a href="/" className="text-sm text-bru-warm-gray hover:text-bru-orange transition-colors">
            ← Ver app pública
          </a>
        </div>
      </div>
    </div>
  )
}

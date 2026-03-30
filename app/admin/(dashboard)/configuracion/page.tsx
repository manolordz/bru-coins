'use client'

import { useEffect, useState, useTransition } from 'react'
import { getSettings, saveSettings } from '@/lib/actions/admin'

export default function ConfiguracionPage() {
  const [adminEmails, setAdminEmails] = useState('')
  const [resendKey, setResendKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getSettings().then((s) => {
      setAdminEmails(s.admin_notification_emails || '')
      setResendKey(s.resend_api_key || '')
    })
  }, [])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await saveSettings({
        admin_notification_emails: adminEmails,
        resend_api_key: resendKey,
      })
      if (result.error) setError(result.error)
      else setSaved(true)
    })
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-bru-black">Configuración</h1>
        <p className="text-bru-warm-gray text-sm mt-0.5">Ajustes de notificaciones y la app</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Notification emails */}
        <div className="card-warm p-6">
          <h2 className="font-display text-lg font-semibold text-bru-black mb-1">
            📧 Notificaciones de canje
          </h2>
          <p className="text-sm text-bru-warm-gray mb-4">
            Cuando un barista canjee un reward, se enviará un email a estas direcciones.
            Separa múltiples correos con comas.
          </p>
          <label className="block text-sm font-medium text-bru-black mb-1.5">
            Correos de administradores
          </label>
          <input
            type="text"
            value={adminEmails}
            onChange={(e) => setAdminEmails(e.target.value)}
            placeholder="admin@bru.com, otro@bru.com"
            className="input-warm"
          />
          <p className="text-xs text-bru-warm-gray mt-1.5">
            También puedes configurarlos como variable de entorno: <code className="bg-bru-parchment px-1 rounded">ADMIN_NOTIFICATION_EMAILS</code>
          </p>
        </div>

        {/* Resend API Key */}
        <div className="card-warm p-6">
          <h2 className="font-display text-lg font-semibold text-bru-black mb-1">
            🔑 Resend API Key
          </h2>
          <p className="text-sm text-bru-warm-gray mb-4">
            Necesitas una cuenta en{' '}
            <span className="text-bru-orange">resend.com</span>{' '}
            para enviar notificaciones por email. La API key empieza con <code className="bg-bru-parchment px-1 rounded">re_</code>.
          </p>
          <label className="block text-sm font-medium text-bru-black mb-1.5">
            API Key
          </label>
          <input
            type="password"
            value={resendKey}
            onChange={(e) => setResendKey(e.target.value)}
            placeholder="re_••••••••••••••••"
            className="input-warm font-mono"
          />
          <p className="text-xs text-bru-warm-gray mt-1.5">
            También puedes configurarla como variable de entorno: <code className="bg-bru-parchment px-1 rounded">RESEND_API_KEY</code>
          </p>
        </div>

        {/* App info */}
        <div className="card-warm p-6 bg-bru-parchment/50">
          <h2 className="font-display text-lg font-semibold text-bru-black mb-3">
            ℹ️ Información
          </h2>
          <div className="space-y-2 text-sm text-bru-warm-gray">
            <div className="flex justify-between">
              <span>Versión de la app</span>
              <span className="font-medium text-bru-black">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Plataforma</span>
              <span className="font-medium text-bru-black">Next.js 14 + Supabase</span>
            </div>
            <div className="flex justify-between">
              <span>Moneda</span>
              <span className="font-display font-semibold text-bru-orange">₿ BRÜ Coins</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {saved && (
          <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            ✅ Configuración guardada correctamente.
          </div>
        )}

        <button type="submit" disabled={isPending} className="btn-orange disabled:opacity-60">
          {isPending ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </form>
    </div>
  )
}

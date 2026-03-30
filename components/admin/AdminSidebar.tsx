'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { adminSignOut } from '@/lib/actions/admin'

const navItems = [
  { href: '/admin/baristas', label: 'Baristas', icon: '👤' },
  { href: '/admin/transacciones', label: 'Transacciones', icon: '📋' },
  { href: '/admin/rewards', label: 'Rewards', icon: '🎁' },
  { href: '/admin/configuracion', label: 'Configuración', icon: '⚙️' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-bru-light-gray px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">☕</span>
          <span className="font-display font-semibold text-bru-black">BRÜ Admin</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-9 h-9 rounded-lg bg-bru-light-gray flex items-center justify-center"
          aria-label="Menú"
        >
          <span className="text-lg">{mobileOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static top-0 left-0 z-20 h-full w-64
        bg-white border-r border-bru-light-gray
        flex flex-col
        transform transition-transform duration-300 lg:transform-none
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-bru-light-gray hidden lg:block">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☕</span>
            <div>
              <p className="font-display font-bold text-bru-black text-lg leading-tight">BRÜ Coins</p>
              <p className="text-xs text-bru-warm-gray">Panel de Administración</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto pt-16 lg:pt-4">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150
                  ${active
                    ? 'bg-bru-orange text-white shadow-warm'
                    : 'text-bru-black hover:bg-bru-parchment hover:text-bru-orange'
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer links */}
        <div className="p-4 border-t border-bru-light-gray space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-bru-warm-gray hover:text-bru-orange hover:bg-bru-parchment transition-all"
          >
            <span>🏠</span> Ver app pública
          </Link>
          <form action={adminSignOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-bru-warm-gray hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <span>🚪</span> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}

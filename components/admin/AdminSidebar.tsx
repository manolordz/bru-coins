'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { adminSignOut } from '@/lib/actions/admin'

interface NavItem {
  href: string
  label: string
  icon: string
  badge?: 'requests' | 'proposals'
}

const allNavItems: NavItem[] = [
  { href: '/admin/baristas',      label: 'Baristas',        icon: '👤' },
  { href: '/admin/transacciones', label: 'Transacciones',   icon: '📋' },
  { href: '/admin/rewards',       label: 'Rewards',         icon: '🎁' },
  { href: '/admin/solicitudes',   label: 'Solicitudes',     icon: '📥', badge: 'requests' },
  { href: '/admin/propuestas',    label: 'Propuestas',      icon: '💡', badge: 'proposals' },
  { href: '/admin/reglas',        label: 'Reglas de Coins', icon: '📏' },
  { href: '/admin/configuracion', label: 'Configuración',   icon: '⚙️' },
]

// First 4 appear in the mobile bottom bar; the rest go in the "More" drawer
const primaryHrefs = ['/admin/baristas', '/admin/solicitudes', '/admin/propuestas', '/admin/rewards']
const primaryItems  = allNavItems.filter(i => primaryHrefs.includes(i.href))
const secondaryItems = allNavItems.filter(i => !primaryHrefs.includes(i.href))

interface AdminSidebarProps {
  pendingRequestsCount?: number
  pendingProposalsCount?: number
}

export function AdminSidebar({
  pendingRequestsCount = 0,
  pendingProposalsCount = 0,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const getBadgeCount = (badge?: NavItem['badge']) => {
    if (badge === 'requests')  return pendingRequestsCount
    if (badge === 'proposals') return pendingProposalsCount
    return 0
  }

  const totalPending = pendingRequestsCount + pendingProposalsCount

  return (
    <>
      {/* ── Desktop sidebar (lg+) ─────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-white border-r border-bru-light-gray min-h-screen sticky top-0 self-start">
        <div className="p-6 border-b border-bru-light-gray">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☕</span>
            <div>
              <p className="font-display font-bold text-bru-black text-lg leading-tight">BRÜ Coins</p>
              <p className="text-xs text-bru-warm-gray">Panel de Administración</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const count  = getBadgeCount(item.badge)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-bru-orange text-white shadow-warm'
                    : 'text-bru-black hover:bg-bru-parchment hover:text-bru-orange'
                }`}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                    active ? 'bg-white text-bru-orange' : 'bg-red-500 text-white'
                  }`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-bru-light-gray space-y-1">
          <Link href="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-bru-warm-gray hover:text-bru-orange hover:bg-bru-parchment transition-all">
            <span>🏠</span> Ver app pública
          </Link>
          <form action={adminSignOut}>
            <button type="submit" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-bru-warm-gray hover:text-red-600 hover:bg-red-50 transition-all">
              <span>🚪</span> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile: thin top bar ──────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-bru-light-gray px-4 h-11 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">☕</span>
          <span className="font-display font-semibold text-bru-black text-sm">BRÜ Admin</span>
        </div>
        {totalPending > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {totalPending > 99 ? '99+' : totalPending}
          </span>
        )}
      </div>

      {/* ── Mobile: bottom navigation bar ────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-bru-light-gray">
        <div className="flex items-stretch h-[60px]">
          {primaryItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const count  = getBadgeCount(item.badge)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                  active ? 'text-bru-orange' : 'text-bru-warm-gray'
                }`}
              >
                <span className="text-[22px] leading-none">{item.icon}</span>
                <span className="text-[9px] font-semibold leading-tight">{item.label.split(' ')[0]}</span>
                {count > 0 && (
                  <span className="absolute top-1.5 right-[calc(50%-14px)] bg-red-500 text-white text-[8px] font-bold px-1 rounded-full min-w-[13px] text-center leading-[13px]">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </Link>
            )
          })}

          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-bru-warm-gray"
          >
            <span className="text-[22px] leading-none">☰</span>
            <span className="text-[9px] font-semibold leading-tight">Más</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile: "More" drawer ─────────────────────────────────────── */}
      {drawerOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-warm-lg animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-bru-light-gray">
              <p className="font-semibold text-sm text-bru-black">Más secciones</p>
              <button onClick={() => setDrawerOpen(false)} className="w-7 h-7 rounded-full bg-bru-light-gray flex items-center justify-center text-bru-warm-gray text-lg leading-none">×</button>
            </div>
            <div className="p-3 space-y-1">
              {secondaryItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const count  = getBadgeCount(item.badge)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      active ? 'bg-bru-orange text-white' : 'text-bru-black hover:bg-bru-parchment hover:text-bru-orange'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
            <div className="px-3 pb-5 pt-1 border-t border-bru-light-gray mt-1 space-y-1">
              <Link href="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-bru-warm-gray hover:bg-bru-parchment">
                <span>🏠</span> Ver app pública
              </Link>
              <form action={adminSignOut}>
                <button type="submit" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-bru-warm-gray hover:text-red-600 hover:bg-red-50">
                  <span>🚪</span> Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  )
}

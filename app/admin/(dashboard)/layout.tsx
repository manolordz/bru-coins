import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const service = createServiceClient()

  // Count both pending badges in parallel
  const [{ count: requestsCount }, { count: proposalsCount }] = await Promise.all([
    service
      .from('coin_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    service
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  return (
    <div className="min-h-screen bg-bru-parchment lg:flex">
      <AdminSidebar
        pendingRequestsCount={requestsCount ?? 0}
        pendingProposalsCount={proposalsCount ?? 0}
      />
      {/* pt-11 offsets the mobile top bar (44px); pb-[76px] offsets the mobile bottom nav (60px + safe area) */}
      <main className="flex-1 min-w-0 pt-11 pb-[76px] lg:pt-0 lg:pb-0">
        {children}
      </main>
    </div>
  )
}

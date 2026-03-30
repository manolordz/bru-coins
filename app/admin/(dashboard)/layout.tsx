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

  // Count pending coin requests for the sidebar badge
  const service = createServiceClient()
  const { count } = await service
    .from('coin_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <div className="min-h-screen bg-bru-parchment flex">
      <AdminSidebar pendingRequestsCount={count ?? 0} />
      <main className="flex-1 lg:ml-0 min-w-0">
        {children}
      </main>
    </div>
  )
}

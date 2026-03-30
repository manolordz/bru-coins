// Bare layout — authentication and sidebar live in (dashboard)/layout.tsx.
// This file exists only so Next.js can resolve /admin/* routes correctly.
// /admin/login is NOT wrapped by (dashboard)/layout.tsx and has no auth check.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

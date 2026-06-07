import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"
import { TrialBanner } from "@/components/layout/trial-banner"
import MobileSidebarWrapper from "@/components/layout/mobile-sidebar-wrapper"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [userOrg, allMemberships] = await Promise.all([
    prisma.userOrganization.findFirst({
      where: { userId: session.user.id, isDefault: true },
      include: { organization: true },
    }),
    prisma.userOrganization.findMany({
      where: { userId: session.user.id },
      include: { organization: { select: { id: true, name: true, country: true, plan: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ])

  if (!userOrg) redirect("/onboarding")

  const org = userOrg.organization
  const orgs = allMemberships.map((m) => ({ ...m.organization, role: m.role }))

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" dir="rtl">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar org={org} />
      </div>

      {/* Mobile sidebar + overlay */}
      <MobileSidebarWrapper org={org} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TrialBanner
          trialEndsAt={org.trialEndsAt}
          hasSubscription={!!org.stripeSubId}
        />
        <Header user={session.user} org={org} orgs={orgs} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"
import { TrialBanner } from "@/components/layout/trial-banner"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })

  if (!userOrg) redirect("/onboarding")

  const org = userOrg.organization

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar org={org} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TrialBanner
          trialEndsAt={org.trialEndsAt}
          hasSubscription={!!org.stripeSubId}
        />
        <Header user={session.user} org={org} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

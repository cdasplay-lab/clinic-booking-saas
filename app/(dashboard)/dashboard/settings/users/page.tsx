import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, ArrowRight } from "lucide-react"
import Link from "next/link"
import TeamManager from "@/components/settings/team-manager"
import { ROLE_LABELS, type OrgRole } from "@/lib/permissions"

export default async function UsersSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const members = await prisma.userOrganization.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  })

  const canManageUsers = ["OWNER", "ADMIN"].includes(userOrg.role)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/settings">
            <ArrowRight className="h-4 w-4 ml-1" /> الإعدادات
          </Link>
        </Button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold">إدارة الفريق</h1>
      </div>

      {/* Current user role banner */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {session.user.name?.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-medium">{session.user.name}</p>
          <p className="text-xs text-blue-600 font-medium">دورك: {ROLE_LABELS[userOrg.role as OrgRole]}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <CardTitle>أعضاء {userOrg.organization.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {canManageUsers ? (
            <TeamManager
              members={members.map((m) => ({
                id: m.id,
                role: m.role as OrgRole,
                createdAt: m.createdAt.toISOString(),
                user: { id: m.user.id, name: m.user.name || m.user.email, email: m.user.email },
              }))}
              currentUserId={session.user.id}
              currentRole={userOrg.role as OrgRole}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">أعضاء الفريق ({members.length})</p>
              <div className="divide-y border rounded-xl overflow-hidden">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {(m.user.name || m.user.email).charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.user.name || m.user.email}</p>
                        <p className="text-xs text-gray-400">{m.user.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{ROLE_LABELS[m.role as OrgRole]}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">لإدارة الأعضاء تواصل مع مالك الحساب.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

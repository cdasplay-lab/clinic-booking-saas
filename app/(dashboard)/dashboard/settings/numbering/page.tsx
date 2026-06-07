import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Hash } from "lucide-react"
import Link from "next/link"
import NumberingSettings from "@/components/settings/numbering-settings"

export default async function NumberingSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  if (!["OWNER", "ADMIN"].includes(userOrg.role)) {
    redirect("/dashboard/settings")
  }

  const sequences = await prisma.documentSequence.findMany({
    where: { organizationId: userOrg.organizationId },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/settings">
            <ArrowRight className="h-4 w-4 ml-1" /> الإعدادات
          </Link>
        </Button>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold">ترقيم المستندات</h1>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        خصص البادئة وعدد الأرقام لكل نوع من المستندات. التغييرات تُطبق على المستندات الجديدة فقط.
      </p>

      <NumberingSettings sequences={sequences} />
    </div>
  )
}

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import AIAgentChat from "@/components/ai-agent/chat"

export default async function AIAgentPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">المساعد المحاسبي الذكي</h1>
        <p className="text-sm text-gray-500">
          اسألني أي سؤال محاسبي، أو اطلب مني إنشاء تقارير، أو تحليل البيانات المالية لشركة {userOrg.organization.name}
        </p>
      </div>
      <AIAgentChat organizationId={userOrg.organizationId} userId={session.user.id} />
    </div>
  )
}

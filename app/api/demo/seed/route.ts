import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { seedDemoData } from "@/lib/demo-data"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Access denied" }, { status: 403 })

  try {
    const result = await seedDemoData(userOrg.organizationId)

    if (result.created === 0) {
      return NextResponse.json({ message: "البيانات التجريبية موجودة بالفعل", created: 0 })
    }

    return NextResponse.json({ message: "تم تحميل البيانات التجريبية بنجاح", created: result.created })
  } catch (error: any) {
    console.error("Demo seed error:", error)
    return NextResponse.json({ error: error.message || "فشل تحميل البيانات" }, { status: 500 })
  }
}

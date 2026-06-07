import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const { reminderEnabled, reminderDays } = await req.json()

  // Validate reminderDays: comma-separated integers, each 0-365
  if (reminderDays !== undefined) {
    const days = String(reminderDays).split(",").map((d) => parseInt(d.trim(), 10))
    if (days.some((d) => isNaN(d) || d < 0 || d > 365)) {
      return NextResponse.json({ error: "قيم أيام التذكير غير صحيحة" }, { status: 400 })
    }
  }

  const org = await prisma.organization.update({
    where: { id: userOrg.organizationId },
    data: {
      ...(reminderEnabled !== undefined && { reminderEnabled: Boolean(reminderEnabled) }),
      ...(reminderDays !== undefined && { reminderDays: String(reminderDays).trim() }),
    },
    select: { reminderEnabled: true, reminderDays: true },
  })

  return NextResponse.json(org)
}

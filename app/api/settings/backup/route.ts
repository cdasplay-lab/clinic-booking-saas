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

  const { backupEnabled, backupEmail } = await req.json()

  const org = await prisma.organization.update({
    where: { id: userOrg.organizationId },
    data: {
      ...(backupEnabled !== undefined && { backupEnabled: Boolean(backupEnabled) }),
      ...(backupEmail   !== undefined && { backupEmail: backupEmail?.trim() || null }),
    },
    select: { backupEnabled: true, backupEmail: true },
  })

  return NextResponse.json(org)
}

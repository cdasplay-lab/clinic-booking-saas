import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST — mark ALL unread notifications as read for this org
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const result = await prisma.notification.updateMany({
    where: {
      organizationId: userOrg.organizationId,
      isRead:         false,
      OR: [{ userId: null }, { userId: session.user.id }],
    },
    data: { isRead: true },
  })

  return NextResponse.json({ updated: result.count })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — fetch recent notifications for current org (last 50, unread first)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const notifications = await prisma.notification.findMany({
    where: {
      organizationId: userOrg.organizationId,
      OR: [
        { userId: null },              // org-wide
        { userId: session.user.id },   // user-specific
      ],
    },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 50,
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return NextResponse.json({ notifications, unreadCount })
}

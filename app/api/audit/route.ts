import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only OWNER/ADMIN can read audit logs
  if (!["OWNER", "ADMIN"].includes(userOrg.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const entityType = searchParams.get("entityType") || undefined
  const entityId   = searchParams.get("entityId") || undefined
  const page       = Math.max(1, Number(searchParams.get("page") || 1))
  const take       = 50

  const where = {
    organizationId: userOrg.organizationId,
    ...(entityType ? { entityType } : {}),
    ...(entityId   ? { entityId }   : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / take) })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId")
  const status     = searchParams.get("status")

  const where: Record<string, unknown> = { organizationId: userOrg.organizationId }
  if (employeeId) where.employeeId = employeeId
  if (status)     where.status     = status

  const commissions = await prisma.salesCommission.findMany({
    where: where as any,
    include: {
      employee: { select: { name: true, employeeId: true } },
      invoice:  { select: { number: true, date: true, contact: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return NextResponse.json(commissions)
}

/** PATCH { ids: string[], status: "PAID" } — mark commissions as paid */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids مطلوبة" }, { status: 400 })
  }

  await prisma.salesCommission.updateMany({
    where: { id: { in: ids }, organizationId: userOrg.organizationId },
    data: { status: "PAID", paidAt: new Date() },
  })

  return NextResponse.json({ ok: true, updated: ids.length })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// PATCH — close a session
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const posSession = await prisma.posSession.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId, cashierId: session.user.id },
  })
  if (!posSession) return NextResponse.json({ error: "الوردية غير موجودة" }, { status: 404 })
  if (posSession.status === "CLOSED") return NextResponse.json({ error: "الوردية مغلقة مسبقاً" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const closingBalance = body.closingBalance !== undefined ? Number(body.closingBalance) : null

  const updated = await prisma.posSession.update({
    where: { id: params.id },
    data: { status: "CLOSED", closedAt: new Date(), closingBalance, notes: body.notes },
  })

  return NextResponse.json(updated)
}

// GET — single session with transactions
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const posSession = await prisma.posSession.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: {
      transactions: {
        include: { items: { include: { product: { select: { name: true } } } } },
        orderBy: { date: "desc" },
      },
    },
  })

  if (!posSession) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  return NextResponse.json(posSession)
}

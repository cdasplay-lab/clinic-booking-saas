import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber, getOrCreateDefaultWarehouse } from "@/lib/org"

// GET — current open session for this cashier
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json(null)

  const posSession = await prisma.posSession.findFirst({
    where: {
      organizationId: userOrg.organizationId,
      cashierId: session.user.id,
      status: "OPEN",
    },
    orderBy: { openedAt: "desc" },
  })

  return NextResponse.json(posSession)
}

// POST — open a new session
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = userOrg.organizationId

  // Check no open session already
  const existing = await prisma.posSession.findFirst({
    where: { organizationId: orgId, cashierId: session.user.id, status: "OPEN" },
  })
  if (existing) return NextResponse.json(existing)

  const body = await req.json().catch(() => ({}))
  const openingBalance = Number(body.openingBalance) || 0

  const warehouse = await getOrCreateDefaultWarehouse(orgId)

  const number = await getNextDocNumber(orgId, "POS")

  const posSession = await prisma.posSession.create({
    data: {
      organizationId: orgId,
      warehouseId:    warehouse.id,
      cashierId:      session.user.id,
      number,
      openingBalance,
    },
  })

  return NextResponse.json(posSession, { status: 201 })
}

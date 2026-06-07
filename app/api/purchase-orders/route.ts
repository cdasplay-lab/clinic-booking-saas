import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber } from "@/lib/org"
import { round2 } from "@/lib/accounting"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orders = await prisma.purchaseOrder.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"] } },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const body = await req.json()
  const { contactId, date, expectedDate, notes, items } = body

  if (!contactId || !date || !items?.length) {
    return NextResponse.json({ error: "المورد والتاريخ والبنود مطلوبة" }, { status: 400 })
  }

  const subtotal = round2(items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unitPrice), 0))
  const number = await getNextDocNumber(userOrg.organizationId, "PO")

  const order = await prisma.purchaseOrder.create({
    data: {
      organizationId: userOrg.organizationId,
      contactId,
      number,
      date: new Date(date),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      currency: userOrg.organization.baseCurrency,
      subtotal,
      total: subtotal,
      notes,
      items: {
        create: items.map((i: any) => ({
          description: i.description,
          productId: i.productId || null,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          total: round2(Number(i.quantity) * Number(i.unitPrice)),
        })),
      },
    },
    include: { items: true },
  })

  return NextResponse.json(order, { status: 201 })
}

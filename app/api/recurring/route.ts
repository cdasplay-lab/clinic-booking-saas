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

  const recurring = await prisma.recurringInvoice.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: true, items: { include: { taxRate: true } } },
    orderBy: { nextDate: "asc" },
  })

  return NextResponse.json(recurring)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(userOrg.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const body = await req.json()
  const { title, contactId, frequency, dueDays, nextDate, endDate, notes, items } = body

  if (!title || !contactId || !frequency || !nextDate || !items?.length) {
    return NextResponse.json({ error: "البيانات الأساسية مطلوبة" }, { status: 400 })
  }

  const recurring = await prisma.recurringInvoice.create({
    data: {
      organizationId: userOrg.organizationId,
      title,
      contactId,
      frequency,
      dueDays: Number(dueDays) || 30,
      nextDate: new Date(nextDate),
      endDate: endDate ? new Date(endDate) : null,
      notes,
      items: {
        create: items.map((item: any, i: number) => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          taxRateId: item.taxRateId || null,
          sortOrder: i,
        })),
      },
    },
    include: { contact: true, items: true },
  })

  return NextResponse.json(recurring, { status: 201 })
}

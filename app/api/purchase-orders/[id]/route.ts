import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { contact: true, items: { include: { product: true } } },
  })
  if (!order) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  return NextResponse.json(order)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!order) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const { status } = await req.json()
  const updated = await prisma.purchaseOrder.update({
    where: { id: params.id },
    data: { status },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!order) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  if (order.status === "CONFIRMED") {
    return NextResponse.json({ error: "لا يمكن حذف أمر مؤكد" }, { status: 400 })
  }

  await prisma.purchaseOrder.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

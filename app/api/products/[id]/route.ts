import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const product = await prisma.product.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { stockLedger: { orderBy: { date: "desc" }, take: 1 } },
  })
  if (!product) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  return NextResponse.json(product)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const product = await prisma.product.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!product) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const data = await req.json()
  const updated = await prisma.product.update({
    where: { id: params.id },
    data: {
      name:          data.name          ?? product.name,
      description:   data.description   ?? product.description,
      unit:          data.unit          ?? product.unit,
      category:      data.category      ?? product.category,
      barcode:       data.barcode       !== undefined ? (data.barcode || null) : product.barcode,
      salePrice:     data.salePrice     !== undefined ? parseFloat(data.salePrice)     : product.salePrice,
      purchasePrice: data.purchasePrice !== undefined ? parseFloat(data.purchasePrice) : product.purchasePrice,
      reorderLevel:  data.reorderLevel  !== undefined ? parseFloat(data.reorderLevel)  : product.reorderLevel,
      isActive:      data.isActive      !== undefined ? data.isActive                  : product.isActive,
    },
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

  await prisma.product.update({
    where: { id: params.id },
    data: { isActive: false },
  })
  return NextResponse.json({ success: true })
}

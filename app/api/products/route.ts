import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const products = await prisma.product.findMany({
    where: { organizationId: userOrg.organizationId, isActive: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const body = await req.json()
  const { code, name, description, unit, category, salePrice, purchasePrice, reorderLevel, isInventoried } = body

  if (!code || !name) return NextResponse.json({ error: "الكود والاسم مطلوبان" }, { status: 400 })

  const product = await prisma.product.create({
    data: {
      organizationId: userOrg.organizationId,
      code,
      name,
      description,
      unit: unit || "PCS",
      category,
      salePrice: parseFloat(salePrice) || 0,
      purchasePrice: parseFloat(purchasePrice) || 0,
      reorderLevel: parseFloat(reorderLevel) || 0,
      isInventoried: isInventoried !== false,
    },
  })
  return NextResponse.json(product, { status: 201 })
}

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const CreateProductSchema = z.object({
  code:          z.string().min(1).max(50).trim(),
  name:          z.string().min(1).max(200).trim(),
  description:   z.string().max(1000).optional().nullable(),
  unit:          z.string().max(20).default("PCS"),
  category:      z.string().max(100).optional().nullable(),
  barcode:       z.string().max(100).optional().nullable(),
  salePrice:     z.coerce.number().min(0).default(0),
  purchasePrice: z.coerce.number().min(0).default(0),
  reorderLevel:  z.coerce.number().min(0).default(0),
  isInventoried: z.boolean().default(true),
})

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

  const parsed = CreateProductSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 })
  }
  const { code, name, description, unit, category, barcode, salePrice, purchasePrice, reorderLevel, isInventoried } = parsed.data

  const product = await prisma.product.create({
    data: {
      organizationId: userOrg.organizationId,
      code,
      name,
      description,
      unit,
      category,
      barcode,
      salePrice,
      purchasePrice,
      reorderLevel,
      isInventoried,
    },
  })
  return NextResponse.json(product, { status: 201 })
}

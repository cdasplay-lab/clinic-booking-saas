import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const assets = await prisma.fixedAsset.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { depreciations: { orderBy: { date: "desc" }, take: 1 } },
    orderBy: { purchaseDate: "desc" },
  })

  return NextResponse.json(assets)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const {
    name, code, category, purchaseDate, purchasePrice,
    depreciationMethod, usefulLife, salvageValue,
  } = await req.json()

  if (!name || !code || !purchaseDate || !purchasePrice) {
    return NextResponse.json({ error: "الاسم والرمز وتاريخ الشراء والتكلفة مطلوبة" }, { status: 400 })
  }

  const price   = Number(purchasePrice)
  const salvage = Number(salvageValue || 0)
  const life    = Number(usefulLife || 5)

  const asset = await prisma.fixedAsset.create({
    data: {
      organizationId: userOrg.organizationId,
      name,
      code,
      category: category || "معدات",
      purchaseDate: new Date(purchaseDate),
      purchasePrice: price,
      currentValue: price,
      depreciationMethod: depreciationMethod || "STRAIGHT_LINE",
      usefulLife: life,
      salvageValue: salvage,
    },
  })

  return NextResponse.json(asset, { status: 201 })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const q       = searchParams.get("q")?.trim() || ""
  const barcode = searchParams.get("barcode")?.trim() || ""

  const products = await prisma.product.findMany({
    where: {
      organizationId: userOrg.organizationId,
      isActive: true,
      ...(barcode
        ? { barcode }
        : q
        ? {
            OR: [
              { name:    { contains: q, mode: "insensitive" } },
              { code:    { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true, code: true, name: true, barcode: true,
      salePrice: true, unit: true, category: true,
      stockLedger: { select: { quantity: true, type: true } },
    },
    orderBy: { name: "asc" },
    take: barcode ? 1 : 50,
  })

  const result = products.map((p) => {
    const totalIn  = p.stockLedger.filter((s) => s.type === "IN").reduce((sum, s) => sum + Number(s.quantity), 0)
    const totalOut = p.stockLedger.filter((s) => s.type === "OUT" || s.type === "ADJUSTMENT").reduce((sum, s) => sum + Math.abs(Number(s.quantity)), 0)
    return {
      id:         p.id,
      code:       p.code,
      name:       p.name,
      barcode:    p.barcode,
      salePrice:  Number(p.salePrice),
      unit:       p.unit,
      category:   p.category,
      stock:      totalIn - totalOut,
    }
  })

  return NextResponse.json(result)
}

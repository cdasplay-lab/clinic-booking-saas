import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOrCreateDefaultWarehouse } from "@/lib/org"
import { round2 } from "@/lib/accounting"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const orgId = userOrg.organizationId
  const body  = await req.json()

  const { adjustments } = body // [{ productId, newQty, reason }]
  if (!adjustments?.length) return NextResponse.json({ error: "لا توجد بيانات" }, { status: 400 })

  const warehouse = await getOrCreateDefaultWarehouse(orgId)

  // For each product, calculate current stock then create ADJUSTMENT entry (signed delta)
  const entries = []
  for (const adj of adjustments) {
    const product = await prisma.product.findFirst({
      where: { id: adj.productId, organizationId: orgId },
      include: { stockLedger: true },
    })
    if (!product) continue

    const currentQty = product.stockLedger.reduce((sum, s) => {
      if (s.type === "IN")         return sum + Number(s.quantity)
      if (s.type === "OUT")        return sum - Number(s.quantity)
      if (s.type === "ADJUSTMENT") return sum + Number(s.quantity) // signed
      return sum
    }, 0)

    const delta = round2(Number(adj.newQty) - currentQty)
    if (delta === 0) continue

    entries.push(
      prisma.stockLedger.create({
        data: {
          productId:   product.id,
          warehouseId: warehouse.id,
          date:        new Date(),
          reference:   "ADJ",
          quantity:    delta,         // signed: positive = add, negative = shrink
          unitCost:    Number(product.purchasePrice),
          type:        "ADJUSTMENT",
        },
      })
    )
  }

  await Promise.all(entries)
  return NextResponse.json({ success: true, adjusted: entries.length })
}

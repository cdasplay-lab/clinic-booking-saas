import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber, getOrCreateDefaultWarehouse } from "@/lib/org"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const counts = await prisma.stockCount.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { warehouse: { select: { name: true } }, _count: { select: { lines: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return NextResponse.json(counts)
}

/** Open a new stock count: snapshot current system quantities for all active inventoried products */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const orgId = userOrg.organizationId
  const body = await req.json().catch(() => ({}))
  const notes = body.notes || null

  const warehouse = await getOrCreateDefaultWarehouse(orgId)

  // Get all active inventoried products
  const products = await prisma.product.findMany({
    where: { organizationId: orgId, isActive: true, isInventoried: true },
    select: { id: true, purchasePrice: true },
  })

  // Compute current system quantity per product from StockLedger (IN positive, OUT negative)
  const ledgerAgg = await prisma.stockLedger.groupBy({
    by: ["productId"],
    where: {
      warehouseId: warehouse.id,
      productId: { in: products.map((p) => p.id) },
    },
    _sum: { quantity: true },
  })
  const systemQtyMap: Record<string, number> = {}
  for (const row of ledgerAgg) {
    systemQtyMap[row.productId] = Number(row._sum.quantity || 0)
  }

  // Get latest weighted-avg cost per product from IN entries
  const costAgg = await prisma.stockLedger.groupBy({
    by: ["productId"],
    where: {
      warehouseId: warehouse.id,
      productId: { in: products.map((p) => p.id) },
      type: "IN",
    },
    _avg: { unitCost: true },
  })
  const costMap: Record<string, number> = {}
  for (const row of costAgg) {
    costMap[row.productId] = Number(row._avg.unitCost || 0)
  }

  const number = await getNextDocNumber(orgId, "JOURNAL")
  const countNumber = `CNT-${number.replace(/\D/g, "").padStart(4, "0")}`

  const stockCount = await prisma.stockCount.create({
    data: {
      organizationId: orgId,
      warehouseId: warehouse.id,
      number: countNumber,
      notes,
      lines: {
        create: products.map((p) => ({
          productId: p.id,
          systemQty: systemQtyMap[p.id] ?? 0,
          countedQty: systemQtyMap[p.id] ?? 0, // default = no variance
          variance: 0,
          unitCost: costMap[p.id] || Number(p.purchasePrice) || 0,
        })),
      },
    },
    include: { lines: { include: { product: { select: { id: true, name: true, code: true, unit: true } } } } },
  })

  return NextResponse.json(stockCount, { status: 201 })
}

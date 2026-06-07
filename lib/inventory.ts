import { prisma } from "./prisma"
import { round2 } from "./accounting"

/**
 * Perpetual inventory accounting helpers.
 *
 * Model: every inventoried purchase increases the Inventory asset (DR Inventory)
 * and adds a StockLedger IN. Every sale records cost of goods sold
 * (DR COGS / CR Inventory) at weighted-average cost and adds a StockLedger OUT.
 *
 * Result: the Inventory GL account always equals the value of physical stock
 * on hand, and gross profit is correct in real time.
 */

/** Weighted-average unit cost from lifetime purchase history (StockLedger IN). Falls back to purchasePrice. */
export async function getWeightedAvgCost(productId: string, fallback: number): Promise<number> {
  const ins = await prisma.stockLedger.findMany({
    where: { productId, type: "IN" },
    select: { quantity: true, unitCost: true },
  })
  let qty = 0
  let cost = 0
  for (const e of ins) {
    const q = Number(e.quantity)
    qty += q
    cost += q * Number(e.unitCost)
  }
  return qty > 0 ? round2(cost / qty) : round2(fallback || 0)
}

/** Resolve the Inventory (STOCK asset) and COGS (EXPENSE) GL accounts for an org. */
export async function getInventoryAccounts(organizationId: string) {
  const inventory = await prisma.account.findFirst({
    where: { organizationId, accountType: "STOCK" },
  })
  let cogs = await prisma.account.findFirst({
    where: { organizationId, accountType: "EXPENSE", code: "5010" },
  })
  if (!cogs) {
    cogs = await prisma.account.findFirst({
      where: { organizationId, accountType: "EXPENSE", name: { contains: "تكلفة" } },
    })
  }
  return { inventory, cogs }
}

/**
 * Given sold line items, compute total COGS and create StockLedger OUT entries.
 * Returns the COGS total so the caller can post DR COGS / CR Inventory.
 *
 * Pass createStockOut=false if the caller already created the OUT entries (e.g. POS).
 */
export async function recordCogsForSale(opts: {
  organizationId: string
  warehouseId: string
  date: Date
  reference: string
  items: Array<{ productId?: string | null; quantity: number }>
  createStockOut?: boolean
}): Promise<number> {
  const { organizationId, warehouseId, date, reference, items, createStockOut = true } = opts

  // Only inventoried products contribute to COGS.
  const productIds = items.map((i) => i.productId).filter(Boolean) as string[]
  if (productIds.length === 0) return 0

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId, isInventoried: true },
    select: { id: true, purchasePrice: true },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))

  let cogsTotal = 0
  for (const item of items) {
    if (!item.productId) continue
    const product = productMap.get(item.productId)
    if (!product) continue // not inventoried — skip

    const qty = Number(item.quantity)
    if (qty <= 0) continue

    const unitCost = await getWeightedAvgCost(product.id, Number(product.purchasePrice))
    cogsTotal = round2(cogsTotal + qty * unitCost)

    if (createStockOut) {
      await prisma.stockLedger.create({
        data: {
          productId: product.id,
          warehouseId,
          date,
          reference,
          quantity: qty,
          unitCost,
          type: "OUT",
        },
      })
    }
  }

  return cogsTotal
}

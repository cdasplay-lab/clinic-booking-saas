import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber } from "@/lib/org"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { getInventoryAccounts, recordCogsForSale } from "@/lib/inventory"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 200 transactions per cashier per hour
  const rl = rateLimit(`pos-tx:${session.user.id}`, { limit: 200, windowSec: 3600 })
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = userOrg.organizationId
  const body  = await req.json()

  const { sessionId, items, paymentMethod, amountPaid, notes } = body
  if (!sessionId || !items?.length) {
    return NextResponse.json({ error: "الوردية والمنتجات مطلوبة" }, { status: 400 })
  }

  const posSession = await prisma.posSession.findFirst({
    where: { id: sessionId, organizationId: orgId, status: "OPEN" },
    include: { warehouse: true },
  })
  if (!posSession) return NextResponse.json({ error: "الوردية غير موجودة أو مغلقة" }, { status: 404 })

  // Validate products + compute totals
  const productIds = items.map((i: any) => i.productId)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: orgId },
  })
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]))

  let subtotal = 0
  const lineItems = items.map((i: any) => {
    const product = productMap[i.productId]
    if (!product) throw new Error(`منتج غير موجود: ${i.productId}`)
    const qty      = Number(i.quantity)
    const price    = Number(i.unitPrice ?? product.salePrice)
    const discount = Number(i.discount ?? 0)
    const total    = round2(qty * price - discount)
    subtotal += total
    return { productId: i.productId, description: product.name, quantity: qty, unitPrice: price, discount, total }
  })

  subtotal = round2(subtotal)
  const total    = subtotal
  const paid     = round2(Number(amountPaid) || total)
  const change   = round2(Math.max(0, paid - total))
  const method   = (paymentMethod || "CASH") as "CASH" | "CARD" | "TRANSFER" | "MIXED"

  const number = await getNextDocNumber(orgId, "RCP") // receipt

  // Create transaction + items in one transaction
  const tx = await prisma.$transaction(async (tx) => {
    const transaction = await tx.posTransaction.create({
      data: {
        organizationId: orgId,
        sessionId,
        number,
        subtotal,
        discountAmount: 0,
        taxAmount: 0,
        total,
        amountPaid: paid,
        change,
        paymentMethod: method,
        status: "COMPLETED",
        notes: notes || null,
        items: {
          create: lineItems,
        },
      },
    })

    // Stock out for each item
    for (const item of lineItems) {
      await tx.stockLedger.create({
        data: {
          productId:   item.productId,
          warehouseId: posSession.warehouseId,
          date:        new Date(),
          reference:   number,
          quantity:    item.quantity,
          unitCost:    item.unitPrice,
          type:        "OUT",
        },
      })
    }

    // Update session totals
    await tx.posSession.update({
      where: { id: sessionId },
      data: {
        totalSales:        { increment: total },
        totalTransactions: { increment: 1 },
        totalCash:         method === "CASH" ? { increment: total } : undefined,
        totalCard:         method === "CARD" ? { increment: total } : undefined,
      },
    })

    return transaction
  })

  // Journal entry: DR Cash/Revenue, CR Sales Revenue
  const [cashAccount, revenueAccount] = await Promise.all([
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: { in: ["CASH", "BANK"] } }, orderBy: { code: "asc" } }),
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "REVENUE" }, orderBy: { code: "asc" } }),
  ])

  if (cashAccount && revenueAccount) {
    await createJournalEntry({
      organizationId: orgId,
      date:           new Date(),
      type:           "SALES",
      description:    `مبيعات POS ${number}`,
      sourceType:     "pos",
      sourceId:       tx.id,
      lines: [
        { accountId: cashAccount.id,    debit: total, credit: 0,     description: `إيصال ${number}` },
        { accountId: revenueAccount.id, debit: 0,     credit: total, description: `مبيعات ${number}` },
      ],
    })
  }

  // Cost of goods sold — stock OUT already created above, so only compute & post COGS
  const cogsTotal = await recordCogsForSale({
    organizationId: orgId,
    warehouseId:    posSession.warehouseId,
    date:           new Date(),
    reference:      number,
    items:          lineItems.map((l: any) => ({ productId: l.productId, quantity: l.quantity })),
    createStockOut: false,
  })

  if (cogsTotal > 0) {
    const { inventory, cogs } = await getInventoryAccounts(orgId)
    if (inventory && cogs) {
      await createJournalEntry({
        organizationId: orgId,
        date:        new Date(),
        type:        "SALES",
        description: `تكلفة بضاعة مباعة — POS ${number}`,
        sourceType:  "pos-cogs",
        sourceId:    tx.id,
        lines: [
          { accountId: cogs.id,      debit: cogsTotal, credit: 0 },
          { accountId: inventory.id, debit: 0,         credit: cogsTotal },
        ],
      })
    }
  }

  return NextResponse.json({ id: tx.id, number, total, change }, { status: 201 })
}

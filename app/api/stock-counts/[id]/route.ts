import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { getInventoryAccounts } from "@/lib/inventory"

/** GET a single stock count with lines */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const count = await prisma.stockCount.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: {
      warehouse: { select: { name: true } },
      lines: {
        include: { product: { select: { id: true, name: true, code: true, unit: true } } },
        orderBy: [{ product: { name: "asc" } }],
      },
    },
  })
  if (!count) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  return NextResponse.json(count)
}

/** PATCH — two actions:
 *  { action: "save", lines: [{ id, countedQty }] } — save counted quantities (draft)
 *  { action: "post" }                               — post adjustments and lock the count
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId: session.user.id, isDefault: true,
      role: { in: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"] },
    },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const orgId = userOrg.organizationId
  const body = await req.json()

  const stockCount = await prisma.stockCount.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { lines: true },
  })
  if (!stockCount) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  if (stockCount.status === "POSTED") {
    return NextResponse.json({ error: "هذا الجرد مقفل بالفعل" }, { status: 409 })
  }

  // ── SAVE (update counted quantities) ────────────────────────────────────────
  if (body.action === "save") {
    const updates: Array<{ id: string; countedQty: number }> = body.lines ?? []
    await Promise.all(
      updates.map(({ id, countedQty }) => {
        const line = stockCount.lines.find((l) => l.id === id)
        if (!line) return null
        const variance = round2(countedQty - Number(line.systemQty))
        return prisma.stockCountLine.update({
          where: { id },
          data: { countedQty, variance },
        })
      })
    )
    return NextResponse.json({ ok: true })
  }

  // ── POST (create adjustment journals + lock) ─────────────────────────────────
  if (body.action === "post") {
    const { inventory } = await getInventoryAccounts(orgId)
    if (!inventory) {
      return NextResponse.json({ error: "لم يتم إعداد حساب المخزون" }, { status: 400 })
    }

    // Find or create an Inventory Adjustment account
    let adjAccount = await prisma.account.findFirst({
      where: { organizationId: orgId, name: { contains: "فروقات الجرد" } },
    })
    if (!adjAccount) {
      adjAccount = await prisma.account.findFirst({
        where: { organizationId: orgId, accountType: "EXPENSE" },
      })
    }
    if (!adjAccount) return NextResponse.json({ error: "لا يوجد حساب مصروفات لترحيل فروقات الجرد" }, { status: 400 })

    // Re-fetch lines with current countedQty
    const lines = await prisma.stockCountLine.findMany({
      where: { stockCountId: params.id, variance: { not: 0 } },
    })

    let totalAdjValue = 0
    const journalLines: Array<{ accountId: string; debit: number; credit: number; description: string }> = []

    for (const line of lines) {
      const variance = Number(line.variance)
      const unitCost = Number(line.unitCost)
      const value = round2(Math.abs(variance) * unitCost)
      if (value < 0.001) continue
      totalAdjValue += value

      if (variance > 0) {
        // Surplus: DR Inventory / CR فروقات الجرد
        journalLines.push({ accountId: inventory.id, debit: value, credit: 0, description: `فائض جرد — ${line.productId}` })
        journalLines.push({ accountId: adjAccount.id, debit: 0, credit: value, description: `فائض جرد` })
      } else {
        // Shortage: DR فروقات الجرد / CR Inventory
        journalLines.push({ accountId: adjAccount.id, debit: value, credit: 0, description: `عجز جرد` })
        journalLines.push({ accountId: inventory.id, debit: 0, credit: value, description: `عجز جرد — ${line.productId}` })
      }

      // Create StockLedger ADJUSTMENT entry
      await prisma.stockLedger.create({
        data: {
          productId: line.productId,
          warehouseId: stockCount.warehouseId,
          date: new Date(),
          reference: stockCount.number,
          quantity: variance,
          unitCost: unitCost,
          type: "ADJUSTMENT",
        },
      })
    }

    let journalId: string | null = null
    if (journalLines.length > 0) {
      const journal = await createJournalEntry({
        organizationId: orgId,
        date: new Date(),
        type: "ADJUSTMENT",
        description: `تسوية جرد ${stockCount.number}`,
        reference: stockCount.number,
        lines: journalLines,
        sourceType: "stock-count",
        sourceId: stockCount.id,
      })
      journalId = journal.id
    }

    await prisma.stockCount.update({
      where: { id: params.id },
      data: { status: "POSTED", postedAt: new Date(), journalId },
    })

    return NextResponse.json({ ok: true, totalAdjValue, linesAdjusted: lines.length })
  }

  return NextResponse.json({ error: "action غير معروف" }, { status: 400 })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber, getOrCreateDefaultWarehouse } from "@/lib/org"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { getInventoryAccounts } from "@/lib/inventory"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const orgId = userOrg.organizationId

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { items: true },
  })
  if (!po) return NextResponse.json({ error: "أمر الشراء غير موجود" }, { status: 404 })
  if (po.status === "CANCELLED") return NextResponse.json({ error: "لا يمكن تحويل أمر ملغى" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const billDate = body.date ? new Date(body.date) : new Date()
  const dueDate  = body.dueDate
    ? new Date(body.dueDate)
    : new Date(billDate.getTime() + 30 * 86_400_000)

  const [apAccount, expenseAccount, taxAccount] = await Promise.all([
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_PAYABLE" } }),
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "EXPENSE" } }),
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "TAX" } }),
  ])

  const number    = await getNextDocNumber(orgId, "BILL")
  const subtotal  = round2(Number(po.subtotal))
  const taxAmount = round2(Number(po.taxAmount))
  const total     = round2(Number(po.total))

  const [bill] = await prisma.$transaction([
    prisma.bill.create({
      data: {
        organizationId: orgId,
        contactId:  po.contactId,
        number,
        type:       "BILL",
        status:     "DRAFT",
        date:       billDate,
        dueDate,
        subtotal,
        taxAmount,
        total,
        amountDue:  total,
        amountPaid: 0,
        notes:      po.notes,
        apAccountId: apAccount?.id,
        purchaseOrderId: po.id,
        items: {
          create: po.items.map((item, idx) => ({
            description: item.description,
            productId:   (item as any).productId || null,
            quantity:    item.quantity,
            unitPrice:   item.unitPrice,
            taxAmount:   0,
            total:       item.total,
            sortOrder:   idx,
          })),
        },
      },
    }),
    prisma.purchaseOrder.update({
      where: { id: po.id },
      data:  { status: "RECEIVED" },
    }),
  ])

  // Split: inventoried products → Inventory asset, the rest → Expense
  const poProductIds = po.items.map((i) => (i as any).productId).filter(Boolean) as string[]
  const invProducts = poProductIds.length
    ? await prisma.product.findMany({ where: { id: { in: poProductIds }, organizationId: orgId, isInventoried: true }, select: { id: true } })
    : []
  const invIds = new Set(invProducts.map((p) => p.id))
  let inventoryAmount = 0
  let expenseAmount = 0
  for (const i of po.items) {
    const net = round2(Number(i.quantity) * Number(i.unitPrice))
    if ((i as any).productId && invIds.has((i as any).productId)) inventoryAmount = round2(inventoryAmount + net)
    else expenseAmount = round2(expenseAmount + net)
  }
  const { inventory: inventoryAccount } = await getInventoryAccounts(orgId)

  if (apAccount && expenseAccount) {
    const invTarget = inventoryAccount ?? expenseAccount
    const jLines: Array<{ accountId: string; debit: number; credit: number; description: string }> = [
      { accountId: apAccount.id, debit: 0, credit: total, description: `فاتورة مورد ${number}` },
    ]
    if (inventoryAmount > 0) jLines.push({ accountId: invTarget.id,     debit: inventoryAmount, credit: 0, description: `مخزون مشتريات ${number}` })
    if (expenseAmount  > 0) jLines.push({ accountId: expenseAccount.id, debit: expenseAmount,   credit: 0, description: `مشتريات ${number}` })
    if (taxAmount > 0 && taxAccount) {
      jLines.push({ accountId: taxAccount.id, debit: taxAmount, credit: 0, description: `ضريبة ${number}` })
    } else if (taxAmount > 0) {
      jLines.push({ accountId: expenseAccount.id, debit: taxAmount, credit: 0, description: `ضريبة ${number}` })
    }
    await createJournalEntry({
      organizationId: orgId,
      date:           billDate,
      type:           "PURCHASE",
      description:    `فاتورة مورد ${number} (محوّلة من أمر شراء ${po.number})`,
      sourceType:     "bill",
      sourceId:       bill.id,
      lines:          jLines,
    })
  }

  // Perpetual stock: StockLedger IN for each inventoried line
  if (invIds.size > 0) {
    const warehouse = await getOrCreateDefaultWarehouse(orgId)
    for (const i of po.items) {
      const pid = (i as any).productId
      if (!pid || !invIds.has(pid) || Number(i.quantity) <= 0) continue
      await prisma.stockLedger.create({
        data: {
          productId: pid,
          warehouseId: warehouse.id,
          date: billDate,
          reference: number,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitPrice),
          type: "IN",
          billId: bill.id,
        },
      })
    }
  }

  return NextResponse.json({ billId: bill.id, number })
}

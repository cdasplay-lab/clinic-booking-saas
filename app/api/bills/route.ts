import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber, getOrCreateDefaultWarehouse } from "@/lib/org"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { getInventoryAccounts } from "@/lib/inventory"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const bills = await prisma.bill.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: true, items: true },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(bills)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const orgId = userOrg.organizationId
  const body = await req.json()
  const { contactId, date, dueDate, vendorRef, notes, items } = body

  if (!contactId || !date || !dueDate || !items?.length) {
    return NextResponse.json({ error: "البيانات الأساسية مطلوبة" }, { status: 400 })
  }

  let subtotal = 0
  let taxAmount = 0
  const lineItems = items.map((item: any) => {
    const qty   = parseFloat(item.quantity)  || 0
    const price = parseFloat(item.unitPrice) || 0
    const lineSubtotal = round2(qty * price)
    const lineTax      = round2(parseFloat(item.taxAmount) || 0)
    subtotal  = round2(subtotal  + lineSubtotal)
    taxAmount = round2(taxAmount + lineTax)
    return { description: item.description, productId: item.productId || null, quantity: qty, unitPrice: price, taxRateId: item.taxRateId || null, taxAmount: lineTax, total: round2(lineSubtotal + lineTax) }
  })

  const total = round2(subtotal + taxAmount)
  const number = await getNextDocNumber(orgId, "BILL")

  // Split the subtotal: inventoried products → Inventory asset, the rest → Expense
  const purchasedProductIds = lineItems.map((l: any) => l.productId).filter(Boolean) as string[]
  const inventoriedProducts = purchasedProductIds.length
    ? await prisma.product.findMany({ where: { id: { in: purchasedProductIds }, organizationId: orgId, isInventoried: true }, select: { id: true } })
    : []
  const inventoriedIds = new Set(inventoriedProducts.map((p) => p.id))

  let inventoryAmount = 0
  let expenseAmount = 0
  for (const l of lineItems as any[]) {
    const lineNet = round2(l.quantity * l.unitPrice)
    if (l.productId && inventoriedIds.has(l.productId)) inventoryAmount = round2(inventoryAmount + lineNet)
    else expenseAmount = round2(expenseAmount + lineNet)
  }

  const apAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_PAYABLE" } })
  const expenseAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "EXPENSE" } })
  const { inventory: inventoryAccount } = await getInventoryAccounts(orgId)

  const bill = await prisma.bill.create({
    data: {
      organizationId: orgId,
      contactId,
      number,
      date: new Date(date),
      dueDate: new Date(dueDate),
      vendorRef,
      subtotal,
      taxAmount,
      total,
      amountDue: total,
      status: "DRAFT",
      notes,
      apAccountId: apAccount?.id,
      items: { create: lineItems },
    },
  })

  if (apAccount && expenseAccount) {
    const journalLines: Array<{ accountId: string; debit: number; credit: number; description: string }> = [
      { accountId: apAccount.id, debit: 0, credit: total, description: `مستحق للمورد ${number}` },
    ]

    // Inventoried goods → Inventory asset (perpetual). Rest → Expense.
    const invTarget = inventoryAccount ?? expenseAccount // fallback if no STOCK account
    if (inventoryAmount > 0) {
      journalLines.push({ accountId: invTarget.id, debit: inventoryAmount, credit: 0, description: `مخزون مشتريات ${number}` })
    }
    if (expenseAmount > 0) {
      journalLines.push({ accountId: expenseAccount.id, debit: expenseAmount, credit: 0, description: `مصروف فاتورة ${number}` })
    }

    if (taxAmount > 0) {
      const taxAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "TAX" } })
      if (taxAccount) {
        journalLines.push({ accountId: taxAccount.id, debit: taxAmount, credit: 0, description: `ضريبة مدخلات ${number}` })
      } else {
        // No tax account — fold tax into expense so the entry stays balanced
        journalLines.push({ accountId: expenseAccount.id, debit: taxAmount, credit: 0, description: `ضريبة فاتورة ${number}` })
      }
    }

    await createJournalEntry({ organizationId: orgId, date: new Date(date), type: "PURCHASE", description: `فاتورة مورد ${number}`, sourceType: "bill", sourceId: bill.id, lines: journalLines })
    await prisma.bill.update({ where: { id: bill.id }, data: { status: "OPEN" } })
  }

  // Perpetual stock: add a StockLedger IN for each inventoried line at its purchase cost
  if (inventoriedIds.size > 0) {
    const warehouse = await getOrCreateDefaultWarehouse(orgId)
    for (const l of lineItems as any[]) {
      if (!l.productId || !inventoriedIds.has(l.productId) || l.quantity <= 0) continue
      await prisma.stockLedger.create({
        data: {
          productId: l.productId,
          warehouseId: warehouse.id,
          date: new Date(date),
          reference: number,
          quantity: l.quantity,
          unitCost: l.unitPrice,
          type: "IN",
          billId: bill.id,
        },
      })
    }
  }

  return NextResponse.json(bill, { status: 201 })
}

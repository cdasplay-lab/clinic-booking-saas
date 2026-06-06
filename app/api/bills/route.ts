import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber } from "@/lib/org"
import { createJournalEntry } from "@/lib/accounting"

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
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    const lineSubtotal = qty * price
    const lineTax = item.taxAmount || 0
    subtotal += lineSubtotal
    taxAmount += lineTax
    return { description: item.description, quantity: qty, unitPrice: price, taxRateId: item.taxRateId || null, taxAmount: lineTax, total: lineSubtotal + lineTax }
  })

  const total = subtotal + taxAmount
  const number = await getNextDocNumber(orgId, "BILL")

  const apAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_PAYABLE" } })
  const expenseAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "EXPENSE" } })

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
    const journalLines = [
      { accountId: expenseAccount.id, debit: subtotal, credit: 0, description: `فاتورة مورد ${number}` },
      { accountId: apAccount.id, debit: 0, credit: total, description: `مستحق للمورد ${number}` },
    ]
    if (taxAmount > 0) {
      const taxAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "TAX" } })
      if (taxAccount) journalLines.push({ accountId: taxAccount.id, debit: taxAmount, credit: 0, description: `ضريبة فاتورة ${number}` })
    }
    await createJournalEntry({ organizationId: orgId, date: new Date(date), type: "PURCHASE", description: `فاتورة مورد ${number}`, sourceType: "bill", sourceId: bill.id, lines: journalLines })
    await prisma.bill.update({ where: { id: bill.id }, data: { status: "OPEN" } })
  }

  return NextResponse.json(bill, { status: 201 })
}

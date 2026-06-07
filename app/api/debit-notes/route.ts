import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber } from "@/lib/org"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const notes = await prisma.bill.findMany({
    where: { organizationId: userOrg.organizationId, type: "DEBIT_NOTE" },
    include: { contact: true, creditedBill: { select: { number: true } } },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const orgId = userOrg.organizationId
  const body = await req.json()
  const { creditedBillId, reason, date, items } = body

  if (!creditedBillId || !date || !items?.length) {
    return NextResponse.json({ error: "البيانات الأساسية مطلوبة" }, { status: 400 })
  }

  const originalBill = await prisma.bill.findFirst({
    where: { id: creditedBillId, organizationId: orgId, type: "BILL" },
    select: { id: true, number: true, contactId: true, apAccountId: true, total: true, amountDue: true, status: true },
  })
  if (!originalBill) return NextResponse.json({ error: "فاتورة المورد الأصلية غير موجودة" }, { status: 404 })

  let subtotal = 0
  let taxAmount = 0
  const lineItems = items.map((item: any) => {
    const qty   = parseFloat(item.quantity)  || 0
    const price = parseFloat(item.unitPrice) || 0
    const lineSubtotal = round2(qty * price)
    const lineTax      = round2(parseFloat(item.taxAmount) || 0)
    subtotal  = round2(subtotal  + lineSubtotal)
    taxAmount = round2(taxAmount + lineTax)
    return {
      description: item.description,
      quantity:    qty,
      unitPrice:   price,
      taxRateId:   item.taxRateId || null,
      taxAmount:   lineTax,
      total:       round2(lineSubtotal + lineTax),
    }
  })
  const total = round2(subtotal + taxAmount)

  if (total > Number(originalBill.total)) {
    return NextResponse.json({ error: `لا يمكن أن يتجاوز إشعار الإضافة إجمالي الفاتورة الأصلية (${originalBill.total})` }, { status: 400 })
  }

  const number = await getNextDocNumber(orgId, "DN")

  const debitNote = await prisma.bill.create({
    data: {
      organizationId: orgId,
      contactId:      originalBill.contactId,
      apAccountId:    originalBill.apAccountId,
      number,
      type:           "DEBIT_NOTE",
      creditedBillId,
      reason,
      date:    new Date(date),
      dueDate: new Date(date),
      subtotal,
      taxAmount,
      total,
      amountDue:  0,
      amountPaid: total,
      status:     "PAID",
      items: { create: lineItems },
    },
  })

  // Reduce original bill amountDue
  const newDue = round2(Math.max(0, Number(originalBill.amountDue) - total))
  await prisma.bill.update({
    where: { id: creditedBillId },
    data: {
      amountDue: newDue,
      status: newDue <= 0 ? "PAID" : "PARTIAL",
    },
  })

  // Reversal journal: DR AP → CR Expense (reverse of bill)
  const apAccount = originalBill.apAccountId
    ? { id: originalBill.apAccountId }
    : await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_PAYABLE" }, select: { id: true } })

  const expenseAccount = await prisma.account.findFirst({
    where: { organizationId: orgId, accountType: "EXPENSE" },
    select: { id: true },
  })

  if (apAccount && expenseAccount) {
    const journalLines: Array<{ accountId: string; debit: number; credit: number; description: string }> = [
      { accountId: apAccount.id, debit: total, credit: 0, description: `إشعار إضافة ${number}` },
    ]

    if (taxAmount > 0) {
      const taxAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "TAX" }, select: { id: true } })
      if (taxAccount) {
        journalLines.push({ accountId: expenseAccount.id, debit: 0, credit: subtotal,  description: `عكس مصروف ${number}` })
        journalLines.push({ accountId: taxAccount.id,     debit: 0, credit: taxAmount, description: `عكس ضريبة مدخلات ${number}` })
      } else {
        journalLines.push({ accountId: expenseAccount.id, debit: 0, credit: total, description: `عكس مصروف ${number}` })
      }
    } else {
      journalLines.push({ accountId: expenseAccount.id, debit: 0, credit: total, description: `عكس مصروف ${number}` })
    }

    await createJournalEntry({
      organizationId: orgId,
      date:           new Date(date),
      type:           "DEBIT_NOTE",
      description:    `إشعار إضافة ${number} — بخصوص فاتورة ${originalBill.number}`,
      sourceType:     "debit_note",
      sourceId:       debitNote.id,
      lines:          journalLines,
    })
  }

  await writeAuditLog({
    organizationId: orgId,
    userId:    session.user.id,
    userName:  session.user.name || session.user.email || "",
    action:    "CREATE",
    entityType: "BILL",
    entityId:   debitNote.id,
    entityLabel: number,
  })

  return NextResponse.json(debitNote, { status: 201 })
}

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

  const notes = await prisma.invoice.findMany({
    where: { organizationId: userOrg.organizationId, type: "CREDIT_NOTE" },
    include: { contact: true, creditedInvoice: { select: { number: true } } },
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
  const { creditedInvoiceId, reason, date, items } = body

  if (!creditedInvoiceId || !date || !items?.length) {
    return NextResponse.json({ error: "البيانات الأساسية مطلوبة" }, { status: 400 })
  }

  // Validate original invoice belongs to this org
  const originalInvoice = await prisma.invoice.findFirst({
    where: { id: creditedInvoiceId, organizationId: orgId, type: "INVOICE" },
    select: { id: true, number: true, contactId: true, arAccountId: true, total: true, amountDue: true, status: true },
  })
  if (!originalInvoice) return NextResponse.json({ error: "الفاتورة الأصلية غير موجودة" }, { status: 404 })

  // Calculate totals
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

  // Validate credit amount doesn't exceed original invoice amountDue
  const maxCreditable = round2(Number(originalInvoice.amountDue) + Number(originalInvoice.total) - Number(originalInvoice.total))
  // Allow crediting up to the original total (even if partly paid)
  if (total > Number(originalInvoice.total)) {
    return NextResponse.json({ error: `لا يمكن أن يتجاوز إشعار الخصم إجمالي الفاتورة الأصلية (${originalInvoice.total})` }, { status: 400 })
  }

  const number = await getNextDocNumber(orgId, "CN")

  const creditNote = await prisma.invoice.create({
    data: {
      organizationId: orgId,
      contactId:      originalInvoice.contactId,
      arAccountId:    originalInvoice.arAccountId,
      number,
      type:               "CREDIT_NOTE",
      creditedInvoiceId,
      reason,
      date:    new Date(date),
      dueDate: new Date(date),
      subtotal,
      taxAmount,
      total,
      amountDue: 0,
      amountPaid: total,
      status: "PAID",
      items: { create: lineItems },
    },
  })

  // Reduce original invoice amountDue
  const newDue = round2(Math.max(0, Number(originalInvoice.amountDue) - total))
  await prisma.invoice.update({
    where: { id: creditedInvoiceId },
    data: {
      amountDue: newDue,
      status: newDue <= 0 ? "PAID" : Number(originalInvoice.amountDue) > 0 ? "PARTIAL" : originalInvoice.status,
    },
  })

  // Create reversal journal entry
  const arAccount = originalInvoice.arAccountId
    ? { id: originalInvoice.arAccountId }
    : await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" }, select: { id: true } })

  const revenueAccount = await prisma.account.findFirst({
    where: { organizationId: orgId, accountType: "REVENUE" },
    select: { id: true },
  })

  if (arAccount && revenueAccount) {
    const journalLines: Array<{ accountId: string; debit: number; credit: number; description: string }> = [
      { accountId: arAccount.id, debit: 0, credit: total, description: `إشعار خصم ${number}` },
    ]

    if (taxAmount > 0) {
      const taxAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "TAX" }, select: { id: true } })
      if (taxAccount) {
        journalLines.push({ accountId: revenueAccount.id, debit: subtotal,  credit: 0, description: `عكس إيرادات ${number}` })
        journalLines.push({ accountId: taxAccount.id,     debit: taxAmount, credit: 0, description: `عكس ضريبة ${number}` })
      } else {
        journalLines.push({ accountId: revenueAccount.id, debit: total, credit: 0, description: `عكس إيرادات ${number}` })
      }
    } else {
      journalLines.push({ accountId: revenueAccount.id, debit: total, credit: 0, description: `عكس إيرادات ${number}` })
    }

    await createJournalEntry({
      organizationId: orgId,
      date:           new Date(date),
      type:           "CREDIT_NOTE",
      description:    `إشعار خصم ${number} — بخصوص فاتورة ${originalInvoice.number}`,
      sourceType:     "credit_note",
      sourceId:       creditNote.id,
      lines:          journalLines,
    })
  }

  await writeAuditLog({
    organizationId: orgId,
    userId:    session.user.id,
    userName:  session.user.name || session.user.email || "",
    action:    "CREATE",
    entityType: "INVOICE",
    entityId:   creditNote.id,
    entityLabel: number,
  })

  return NextResponse.json(creditNote, { status: 201 })
}

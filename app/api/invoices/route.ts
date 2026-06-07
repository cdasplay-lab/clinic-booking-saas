import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber } from "@/lib/org"
import { createJournalEntry } from "@/lib/accounting"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: true, items: true },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const orgId = userOrg.organizationId
  const body = await req.json()
  const { contactId, date, dueDate, notes, items } = body

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
    return {
      description: item.description,
      quantity: qty,
      unitPrice: price,
      taxRateId: item.taxRateId || null,
      taxAmount: lineTax,
      total: lineSubtotal + lineTax,
    }
  })

  const total = subtotal + taxAmount
  const number = await getNextDocNumber(orgId, "INVOICE")

  // Find AR account
  const arAccount = await prisma.account.findFirst({
    where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" },
  })
  const revenueAccount = await prisma.account.findFirst({
    where: { organizationId: orgId, accountType: "REVENUE" },
  })

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: orgId,
      contactId,
      number,
      date: new Date(date),
      dueDate: new Date(dueDate),
      subtotal,
      taxAmount,
      total,
      amountDue: total,
      status: "DRAFT",
      notes,
      arAccountId: arAccount?.id,
      items: { create: lineItems },
    },
  })

  // Create journal entry if we have accounts
  if (arAccount && revenueAccount) {
    const journalLines = [
      { accountId: arAccount.id, debit: total, credit: 0, description: `فاتورة ${number}` },
      { accountId: revenueAccount.id, debit: 0, credit: subtotal, description: `إيرادات فاتورة ${number}` },
    ]

    if (taxAmount > 0) {
      const taxAccount = await prisma.account.findFirst({
        where: { organizationId: orgId, accountType: "TAX" },
      })
      if (taxAccount) {
        journalLines.push({ accountId: taxAccount.id, debit: 0, credit: taxAmount, description: `ضريبة فاتورة ${number}` })
      }
    }

    await createJournalEntry({
      organizationId: orgId,
      date: new Date(date),
      type: "SALES",
      description: `فاتورة مبيعات ${number}`,
      sourceType: "invoice",
      sourceId: invoice.id,
      lines: journalLines,
    })

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "SENT" },
    })
  }

  await writeAuditLog({
    organizationId: orgId,
    userId: session.user.id,
    userName: session.user.name || session.user.email || "",
    action: "CREATE",
    entityType: "INVOICE",
    entityId: invoice.id,
    entityLabel: number,
    ipAddress: req.headers.get("x-forwarded-for") || undefined,
  })

  return NextResponse.json(invoice, { status: 201 })
}

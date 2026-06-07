import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber } from "@/lib/org"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { notifyQuoteConverted } from "@/lib/notify"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const orgId = userOrg.organizationId

  const quote = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: orgId, type: "QUOTE" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  })
  if (!quote) return NextResponse.json({ error: "عرض السعر غير موجود" }, { status: 404 })
  if (quote.status === "CONVERTED") {
    return NextResponse.json({ error: "تم تحويل هذا العرض مسبقاً" }, { status: 400 })
  }
  if (quote.status === "CANCELLED") {
    return NextResponse.json({ error: "لا يمكن تحويل عرض ملغى" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const invoiceDate = body.date ? new Date(body.date) : new Date()
  const dueDate = body.dueDate
    ? new Date(body.dueDate)
    : new Date(invoiceDate.getTime() + 30 * 86_400_000)

  // Get accounts for journal
  const [arAccount, revenueAccount, taxAccount] = await Promise.all([
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" } }),
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "REVENUE" } }),
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "TAX" } }),
  ])

  const number = await getNextDocNumber(orgId, "INVOICE")
  const subtotal  = round2(Number(quote.subtotal))
  const taxAmount = round2(Number(quote.taxAmount))
  const total     = round2(Number(quote.total))

  const [invoice] = await prisma.$transaction([
    // Create the real invoice
    prisma.invoice.create({
      data: {
        organizationId: orgId,
        contactId:  quote.contactId,
        number,
        type:       "INVOICE",
        status:     "DRAFT",
        date:       invoiceDate,
        dueDate,
        subtotal,
        taxAmount,
        total,
        amountDue:  total,
        amountPaid: 0,
        notes:      quote.notes,
        terms:      quote.terms,
        arAccountId: arAccount?.id,
        items: {
          create: quote.items.map((item) => ({
            description: item.description,
            quantity:    item.quantity,
            unitPrice:   item.unitPrice,
            taxRateId:   item.taxRateId,
            taxAmount:   item.taxAmount,
            total:       item.total,
            sortOrder:   item.sortOrder,
          })),
        },
      },
    }),
    // Mark quote as converted
    prisma.invoice.update({
      where: { id: quote.id },
      data:  { status: "CONVERTED" },
    }),
  ])

  // Create journal entry for the new invoice
  if (arAccount && revenueAccount) {
    const jLines = [
      { accountId: arAccount.id,     debit: total,     credit: 0,          description: `فاتورة ${number}` },
      { accountId: revenueAccount.id, debit: 0,        credit: subtotal,   description: `إيرادات ${number}` },
    ]
    if (taxAmount > 0 && taxAccount) {
      jLines.push({ accountId: taxAccount.id, debit: 0, credit: taxAmount, description: `ضريبة ${number}` })
    } else if (taxAmount > 0) {
      // No tax account — merge into revenue to keep entry balanced
      jLines[1].credit = round2(jLines[1].credit + taxAmount)
    }
    await createJournalEntry({
      organizationId: orgId,
      date:           invoiceDate,
      type:           "SALES",
      description:    `فاتورة ${number} (محوّلة من عرض ${quote.number})`,
      sourceType:     "invoice",
      sourceId:       invoice.id,
      lines:          jLines,
    })
  }

  // Update quote's convertedInvoiceId
  await prisma.invoice.update({
    where: { id: quote.id },
    data:  { convertedInvoiceId: invoice.id },
  })

  // Notify org about conversion
  notifyQuoteConverted(orgId, quote.number, number, invoice.id).catch(() => {})

  return NextResponse.json({ invoiceId: invoice.id, number })
}

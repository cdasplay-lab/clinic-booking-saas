import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber } from "@/lib/org"
import { createJournalEntry, round2 } from "@/lib/accounting"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const orgId = userOrg.organizationId

  const so = await prisma.salesOrder.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: { items: true },
  })
  if (!so) return NextResponse.json({ error: "أمر البيع غير موجود" }, { status: 404 })
  if (so.status === "INVOICED") return NextResponse.json({ error: "تم تحويل هذا الأمر مسبقاً" }, { status: 400 })
  if (so.status === "CANCELLED") return NextResponse.json({ error: "لا يمكن تحويل أمر ملغى" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const invoiceDate = body.date ? new Date(body.date) : new Date()
  const dueDate = body.dueDate
    ? new Date(body.dueDate)
    : new Date(invoiceDate.getTime() + 30 * 86_400_000)

  const [arAccount, revenueAccount, taxAccount] = await Promise.all([
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" } }),
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "REVENUE" } }),
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "TAX" } }),
  ])

  const number   = await getNextDocNumber(orgId, "INVOICE")
  const subtotal = round2(Number(so.subtotal))
  const taxAmount = round2(Number(so.taxAmount))
  const total    = round2(Number(so.total))

  const [invoice] = await prisma.$transaction([
    prisma.invoice.create({
      data: {
        organizationId: orgId,
        contactId: so.contactId,
        number,
        type:      "INVOICE",
        status:    "DRAFT",
        date:      invoiceDate,
        dueDate,
        subtotal,
        taxAmount,
        total,
        amountDue:  total,
        amountPaid: 0,
        notes:     so.notes,
        arAccountId: arAccount?.id,
        items: {
          create: so.items.map((item, idx) => ({
            description: item.description,
            quantity:    item.quantity,
            unitPrice:   item.unitPrice,
            taxAmount:   0,
            total:       item.total,
            sortOrder:   idx,
          })),
        },
      },
    }),
    prisma.salesOrder.update({
      where: { id: so.id },
      data:  { status: "INVOICED" },
    }),
  ])

  if (arAccount && revenueAccount) {
    const jLines = [
      { accountId: arAccount.id,     debit: total,    credit: 0,       description: `فاتورة ${number}` },
      { accountId: revenueAccount.id, debit: 0,       credit: subtotal, description: `إيرادات ${number}` },
    ]
    if (taxAmount > 0 && taxAccount) {
      jLines.push({ accountId: taxAccount.id, debit: 0, credit: taxAmount, description: `ضريبة ${number}` })
    } else if (taxAmount > 0) {
      jLines[1].credit = round2(jLines[1].credit + taxAmount)
    }
    await createJournalEntry({
      organizationId: orgId,
      date:           invoiceDate,
      type:           "SALES",
      description:    `فاتورة ${number} (محوّلة من أمر بيع ${so.number})`,
      sourceType:     "invoice",
      sourceId:       invoice.id,
      lines:          jLines,
    })
  }

  return NextResponse.json({ invoiceId: invoice.id, number })
}

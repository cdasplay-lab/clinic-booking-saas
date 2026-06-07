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

  if (apAccount && expenseAccount) {
    const jLines = [
      { accountId: expenseAccount.id, debit: subtotal, credit: 0,     description: `مشتريات ${number}` },
      { accountId: apAccount.id,      debit: 0,        credit: total, description: `فاتورة مورد ${number}` },
    ]
    if (taxAmount > 0 && taxAccount) {
      jLines.push({ accountId: taxAccount.id, debit: taxAmount, credit: 0, description: `ضريبة ${number}` })
      // Reduce expense debit to keep balance
      jLines[0].debit = subtotal
    } else if (taxAmount > 0) {
      jLines[0].debit = round2(jLines[0].debit + taxAmount)
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

  return NextResponse.json({ billId: bill.id, number })
}

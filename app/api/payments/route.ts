import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { notifyPaymentReceived, notifyPaymentSent } from "@/lib/notify"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const payments = await prisma.payment.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: true, invoice: true, bill: true },
    orderBy: { date: "desc" },
  })
  return NextResponse.json(payments)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const orgId = userOrg.organizationId
  const body = await req.json()
  const { contactId, invoiceId, billId, type, date, amount, method, reference, bankAccountId, notes } = body

  if (!type || !date || !amount) return NextResponse.json({ error: "البيانات الأساسية مطلوبة" }, { status: 400 })

  const payAmount = round2(parseFloat(amount))
  if (isNaN(payAmount) || payAmount <= 0) return NextResponse.json({ error: "مبلغ غير صالح" }, { status: 400 })

  const payment = await prisma.payment.create({
    data: {
      organizationId: orgId,
      contactId,
      invoiceId,
      billId,
      type,
      date: new Date(date),
      amount: payAmount,
      method: method || "BANK_TRANSFER",
      reference,
      bankAccountId,
      notes,
    },
  })

  // ── Update invoice/bill balance ───────────────────────────────────────────
  if (invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (inv) {
      const newPaid = round2(Number(inv.amountPaid) + payAmount)
      const newDue  = round2(Math.max(0, Number(inv.total) - newPaid))
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: newPaid, amountDue: newDue, status: newDue <= 0 ? "PAID" : "PARTIAL" },
      })
    }
  }
  if (billId) {
    const bill = await prisma.bill.findUnique({ where: { id: billId } })
    if (bill) {
      const newPaid = round2(Number(bill.amountPaid) + payAmount)
      const newDue  = round2(Math.max(0, Number(bill.total) - newPaid))
      await prisma.bill.update({
        where: { id: billId },
        data: { amountPaid: newPaid, amountDue: newDue, status: newDue <= 0 ? "PAID" : "PARTIAL" },
      })
    }
  }

  // ── Create double-entry journal for the payment ───────────────────────────
  // Resolve the cash/bank account to use
  let cashAccount: { id: string } | null = null
  if (bankAccountId) {
    cashAccount = await prisma.account.findFirst({
      where: { id: bankAccountId, organizationId: orgId },
      select: { id: true },
    })
  }
  if (!cashAccount) {
    cashAccount = await prisma.account.findFirst({
      where: { organizationId: orgId, accountType: { in: ["BANK", "CASH"] } },
      select: { id: true },
    })
  }

  if (cashAccount) {
    if (invoiceId) {
      // Incoming payment: customer pays invoice
      // DR Cash/Bank  →  CR Accounts Receivable
      const inv = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { arAccountId: true, number: true },
      })
      const arAccountId = inv?.arAccountId
        ?? (await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" }, select: { id: true } }))?.id

      if (arAccountId) {
        await createJournalEntry({
          organizationId: orgId,
          date: new Date(date),
          type: "RECEIPT",
          description: `تحصيل فاتورة ${inv?.number ?? invoiceId}${reference ? ` — ${reference}` : ""}`,
          sourceType: "payment",
          sourceId: payment.id,
          lines: [
            { accountId: cashAccount.id, debit: payAmount, credit: 0,         description: "نقد مستلم" },
            { accountId: arAccountId,    debit: 0,         credit: payAmount,  description: "تسوية ذمم مدينة" },
          ],
        })
      }
    } else if (billId) {
      // Outgoing payment: company pays vendor bill
      // DR Accounts Payable  →  CR Cash/Bank
      const bill = await prisma.bill.findUnique({
        where: { id: billId },
        select: { apAccountId: true, number: true },
      })
      const apAccountId = bill?.apAccountId
        ?? (await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_PAYABLE" }, select: { id: true } }))?.id

      if (apAccountId) {
        await createJournalEntry({
          organizationId: orgId,
          date: new Date(date),
          type: "PAYMENT",
          description: `دفع فاتورة مورد ${bill?.number ?? billId}${reference ? ` — ${reference}` : ""}`,
          sourceType: "payment",
          sourceId: payment.id,
          lines: [
            { accountId: apAccountId,    debit: payAmount, credit: 0,         description: "تسوية ذمم دائنة" },
            { accountId: cashAccount.id, debit: 0,         credit: payAmount,  description: "نقد مدفوع" },
          ],
        })
      }
    }
  }

  // Fire-and-forget notifications (don't block response)
  const contactRecord = contactId
    ? await prisma.contact.findUnique({ where: { id: contactId }, select: { name: true } }).catch(() => null)
    : null
  const contactName = contactRecord?.name || ""
  const amountStr   = `${payAmount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}`
  if (type === "INCOMING") {
    notifyPaymentReceived(orgId, amountStr, contactName, payment.id).catch(() => {})
  } else if (type === "OUTGOING") {
    notifyPaymentSent(orgId, amountStr, contactName).catch(() => {})
  }

  return NextResponse.json(payment, { status: 201 })
}

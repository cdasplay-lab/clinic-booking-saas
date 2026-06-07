import { prisma } from "@/lib/prisma"
import { round2, createJournalEntry } from "@/lib/accounting"
import { notifyPaymentReceived } from "@/lib/notify"

interface Options {
  orgId:            string
  invoiceId:        string
  contactId:        string
  amount:           number
  method?:          string
  reference?:       string
  stripeSessionId?: string
}

export async function recordInvoicePayment({
  orgId, invoiceId, contactId, amount, method = "BANK_TRANSFER", reference, stripeSessionId,
}: Options) {
  const payAmount = round2(amount)

  // 1. Create payment record
  const payment = await prisma.payment.create({
    data: {
      organizationId: orgId,
      contactId,
      invoiceId,
      type:      "INCOMING",
      date:      new Date(),
      amount:    payAmount,
      method:    method as any,
      reference: reference || stripeSessionId || undefined,
      notes:     stripeSessionId ? `Stripe: ${stripeSessionId}` : undefined,
    },
  })

  // 2. Update invoice balance
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!inv) return payment

  const newPaid = round2(Number(inv.amountPaid) + payAmount)
  const newDue  = round2(Math.max(0, Number(inv.total) - newPaid))
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: newPaid,
      amountDue:  newDue,
      status:     newDue <= 0 ? "PAID" : "PARTIAL",
    },
  })

  // 3. Journal: DR Cash → CR Accounts Receivable
  const cashAccount = await prisma.account.findFirst({
    where: { organizationId: orgId, accountType: { in: ["BANK", "CASH"] } },
    select: { id: true },
  })
  const arAccount = inv.arAccountId
    ? { id: inv.arAccountId }
    : await prisma.account.findFirst({
        where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" },
        select: { id: true },
      })

  if (cashAccount && arAccount) {
    await createJournalEntry({
      organizationId: orgId,
      date:           new Date(),
      type:           "GENERAL",
      description:    `دفعة للفاتورة ${inv.number}`,
      reference:      `PAY-${inv.number}`,
      sourceType:     "payment",
      sourceId:       payment.id,
      lines: [
        { accountId: cashAccount.id, debit: payAmount, credit: 0, description: `دفعة ${inv.number}` },
        { accountId: arAccount.id,   debit: 0, credit: payAmount, description: `دفعة ${inv.number}` },
      ],
    })
  }

  // 4. Notify (fire-and-forget)
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { name: true } })
  notifyPaymentReceived(orgId, String(payAmount), contact?.name || "", payment.id).catch(() => {})

  return payment
}

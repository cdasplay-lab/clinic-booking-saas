import { prisma } from "./prisma"

/**
 * Credit limit control — حد الائتمان
 *
 * Sums what a customer currently owes (open invoice balances + post-dated
 * incoming cheques that haven't cleared yet) and checks it against their
 * assigned credit limit before letting a new credit sale go through.
 */

export type CreditCheck = {
  hasLimit:    boolean
  limit:       number
  outstanding: number   // current exposure before the new sale
  newTotal:    number   // the sale being attempted
  projected:   number   // outstanding + newTotal
  available:   number   // limit - outstanding
  exceeded:    boolean  // projected > limit
}

/** Current receivable exposure for a customer: open invoices + uncleared incoming cheques. */
export async function getCustomerOutstanding(
  organizationId: string,
  contactId: string,
): Promise<number> {
  const [invoiceAgg, chequeAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        organizationId,
        contactId,
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
      },
      _sum: { amountDue: true },
    }),
    // Incoming post-dated cheques not yet cleared still represent collection risk
    prisma.cheque.aggregate({
      where: {
        organizationId,
        contactId,
        type: "INCOMING",
        status: { in: ["PENDING", "DEPOSITED"] },
      },
      _sum: { amount: true },
    }),
  ])

  const invoices = Number(invoiceAgg._sum.amountDue || 0)
  const cheques  = Number(chequeAgg._sum.amount || 0)
  return invoices + cheques
}

/**
 * Check whether a new credit sale of `newTotal` keeps the customer within their
 * credit limit. When the customer has no limit set, the sale always passes.
 */
export async function checkCreditLimit(
  organizationId: string,
  contactId: string,
  newTotal: number,
): Promise<CreditCheck> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    select: { creditLimit: true },
  })

  const limit = Number(contact?.creditLimit || 0)
  const hasLimit = limit > 0

  const outstanding = hasLimit ? await getCustomerOutstanding(organizationId, contactId) : 0
  const projected = outstanding + newTotal

  return {
    hasLimit,
    limit,
    outstanding,
    newTotal,
    projected,
    available: limit - outstanding,
    exceeded: hasLimit && projected > limit + 0.01,
  }
}

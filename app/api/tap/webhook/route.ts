import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTapCharge } from "@/lib/tap"
import { createJournalEntry } from "@/lib/accounting"
import { writeAuditLog } from "@/lib/audit"

// Tap sends POST with charge object when payment status changes
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Tap webhook body is the charge object itself
  const chargeId: string = body?.id || body?.charge_id
  if (!chargeId) return NextResponse.json({ ok: true }) // ignore unknown events

  // Verify charge with Tap API directly (don't trust webhook body alone)
  let charge: any
  try {
    charge = await getTapCharge(chargeId)
  } catch {
    return NextResponse.json({ error: "Could not verify charge" }, { status: 400 })
  }

  if (charge.status !== "CAPTURED") {
    return NextResponse.json({ ok: true, status: charge.status })
  }

  // Find invoice by order reference
  const invoiceId = charge.reference?.order || body.reference?.order
  if (!invoiceId) return NextResponse.json({ ok: true })

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  })
  if (!invoice) return NextResponse.json({ ok: true })

  // Idempotency: check if we already recorded this charge
  const existing = await prisma.payment.findFirst({
    where: { reference: chargeId },
  })
  if (existing) return NextResponse.json({ ok: true, already: true })

  const paidAmount = charge.amount
  const newPaid = Number(invoice.amountPaid) + paidAmount
  const newDue = Math.max(0, Number(invoice.total) - newPaid)

  // Find bank/online account
  const arAccount = await prisma.account.findFirst({
    where: { organizationId: invoice.organizationId, accountType: "ACCOUNTS_RECEIVABLE" },
  })
  const bankAccount = await prisma.account.findFirst({
    where: { organizationId: invoice.organizationId, accountType: "BANK" },
  })

  const payment = await prisma.payment.create({
    data: {
      organizationId: invoice.organizationId,
      contactId: invoice.contactId,
      invoiceId: invoice.id,
      type: "INCOMING",
      date: new Date(),
      amount: paidAmount,
      currency: charge.currency,
      method: "ONLINE",
      reference: chargeId,
      notes: `Tap Payments — ${chargeId}`,
    },
  })

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: newPaid,
      amountDue: newDue,
      status: newDue <= 0 ? "PAID" : "PARTIAL",
    },
  })

  // Journal: Dr Bank / Cr AR
  if (arAccount && bankAccount) {
    await createJournalEntry({
      organizationId: invoice.organizationId,
      date: new Date(),
      type: "RECEIPT",
      description: `دفعة Tap Payments للفاتورة ${invoice.number}`,
      sourceType: "payment",
      sourceId: payment.id,
      lines: [
        { accountId: bankAccount.id, debit: paidAmount, credit: 0, description: `Tap ${chargeId}` },
        { accountId: arAccount.id, debit: 0, credit: paidAmount, description: `تسوية فاتورة ${invoice.number}` },
      ],
    })
  }

  await writeAuditLog({
    organizationId: invoice.organizationId,
    userId: "tap-webhook",
    userName: "Tap Payments",
    action: "PAY",
    entityType: "INVOICE",
    entityId: invoice.id,
    entityLabel: invoice.number,
    changes: { amount: [null, paidAmount], chargeId: [null, chargeId] },
  })

  return NextResponse.json({ ok: true, paymentId: payment.id })
}

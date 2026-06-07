import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { round2 } from "@/lib/accounting"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = userOrg.organizationId
  const { searchParams } = req.nextUrl
  const now = new Date()
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(now.getFullYear(), 0, 1)
  const to = searchParams.get("to")
    ? new Date(searchParams.get("to")!)
    : new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  to.setHours(23, 59, 59, 999)

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true, name: true, email: true, phone: true, address: true, taxNumber: true, type: true },
  })
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isVendor = contact.type === "VENDOR"
  const isCustomer = contact.type === "CUSTOMER" || contact.type === "BOTH"

  // ── Build transactions ────────────────────────────────────────────────────

  type Txn = {
    id: string
    date: Date
    type: string
    number: string
    description: string
    debit: number
    credit: number
    ref?: string
  }

  const allTxns: Txn[] = []

  if (isCustomer || contact.type === "BOTH") {
    // Invoices → debit (they owe us)
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: orgId, contactId: params.id, type: "INVOICE" },
      select: { id: true, number: true, date: true, total: true, notes: true },
    })
    for (const inv of invoices) {
      allTxns.push({ id: inv.id, date: inv.date, type: "INVOICE", number: inv.number, description: `فاتورة ${inv.number}`, debit: Number(inv.total), credit: 0 })
    }

    // Credit notes → credit (reduce what they owe)
    const creditNotes = await prisma.invoice.findMany({
      where: { organizationId: orgId, contactId: params.id, type: "CREDIT_NOTE" },
      select: { id: true, number: true, date: true, total: true, reason: true, creditedInvoice: { select: { number: true } } },
    })
    for (const cn of creditNotes) {
      allTxns.push({ id: cn.id, date: cn.date, type: "CREDIT_NOTE", number: cn.number, description: `إشعار خصم ${cn.number}${cn.creditedInvoice ? ` (${cn.creditedInvoice.number})` : ""}`, debit: 0, credit: Number(cn.total) })
    }

    // Incoming payments → credit (they paid us)
    const payments = await prisma.payment.findMany({
      where: { organizationId: orgId, contactId: params.id, type: "INCOMING" },
      select: { id: true, date: true, amount: true, reference: true, method: true },
    })
    for (const p of payments) {
      allTxns.push({ id: p.id, date: p.date, type: "PAYMENT", number: p.reference || p.id.slice(-6).toUpperCase(), description: `دفعة مستلمة${p.reference ? ` — ${p.reference}` : ""}`, debit: 0, credit: Number(p.amount) })
    }
  }

  if (isVendor || contact.type === "BOTH") {
    // Bills → credit (we owe them)
    const bills = await prisma.bill.findMany({
      where: { organizationId: orgId, contactId: params.id, type: "BILL" },
      select: { id: true, number: true, date: true, total: true },
    })
    for (const b of bills) {
      allTxns.push({ id: b.id, date: b.date, type: "BILL", number: b.number, description: `فاتورة مورد ${b.number}`, debit: 0, credit: Number(b.total) })
    }

    // Debit notes → debit (reduce what we owe)
    const debitNotes = await prisma.bill.findMany({
      where: { organizationId: orgId, contactId: params.id, type: "DEBIT_NOTE" },
      select: { id: true, number: true, date: true, total: true, reason: true, creditedBill: { select: { number: true } } },
    })
    for (const dn of debitNotes) {
      allTxns.push({ id: dn.id, date: dn.date, type: "DEBIT_NOTE", number: dn.number, description: `إشعار إضافة ${dn.number}${dn.creditedBill ? ` (${dn.creditedBill.number})` : ""}`, debit: Number(dn.total), credit: 0 })
    }

    // Outgoing payments → debit (we paid them)
    const payments = await prisma.payment.findMany({
      where: { organizationId: orgId, contactId: params.id, type: "OUTGOING" },
      select: { id: true, date: true, amount: true, reference: true },
    })
    for (const p of payments) {
      allTxns.push({ id: p.id, date: p.date, type: "PAYMENT_OUT", number: p.reference || p.id.slice(-6).toUpperCase(), description: `دفعة مدفوعة${p.reference ? ` — ${p.reference}` : ""}`, debit: Number(p.amount), credit: 0 })
    }
  }

  // Sort all transactions by date
  allTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Opening balance: net of all transactions BEFORE the period
  const beforePeriod = allTxns.filter((t) => new Date(t.date) < from)
  const openingBalance = round2(
    beforePeriod.reduce((s, t) => s + t.debit - t.credit, 0)
  )

  // Period transactions
  const periodTxns = allTxns.filter(
    (t) => new Date(t.date) >= from && new Date(t.date) <= to
  )

  // Build running balance
  let running = openingBalance
  const transactions = periodTxns.map((t) => {
    running = round2(running + t.debit - t.credit)
    return { ...t, date: t.date.toISOString(), balance: running }
  })

  return NextResponse.json({
    contact,
    organization: {
      name:      userOrg.organization.name,
      address:   userOrg.organization.address,
      phone:     userOrg.organization.phone,
      email:     userOrg.organization.email,
      taxNumber: userOrg.organization.taxNumber,
    },
    period:         { from: from.toISOString(), to: to.toISOString() },
    currency:       userOrg.organization.baseCurrency || "SAR",
    openingBalance,
    transactions,
    closingBalance: running,
    totalDebit:     round2(periodTxns.reduce((s, t) => s + t.debit, 0)),
    totalCredit:    round2(periodTxns.reduce((s, t) => s + t.credit, 0)),
  })
}

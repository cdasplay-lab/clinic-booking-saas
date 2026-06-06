import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createJournalEntry } from "@/lib/accounting"

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

  const payment = await prisma.payment.create({
    data: { organizationId: orgId, contactId, invoiceId, billId, type, date: new Date(date), amount: parseFloat(amount), method: method || "BANK_TRANSFER", reference, bankAccountId, notes },
  })

  // Update invoice/bill balance
  if (invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (inv) {
      const newPaid = Number(inv.amountPaid) + parseFloat(amount)
      const newDue = Number(inv.total) - newPaid
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: newPaid, amountDue: Math.max(0, newDue), status: newDue <= 0 ? "PAID" : "PARTIAL" },
      })
    }
  }
  if (billId) {
    const bill = await prisma.bill.findUnique({ where: { id: billId } })
    if (bill) {
      const newPaid = Number(bill.amountPaid) + parseFloat(amount)
      const newDue = Number(bill.total) - newPaid
      await prisma.bill.update({
        where: { id: billId },
        data: { amountPaid: newPaid, amountDue: Math.max(0, newDue), status: newDue <= 0 ? "PAID" : "PARTIAL" },
      })
    }
  }

  return NextResponse.json(payment, { status: 201 })
}

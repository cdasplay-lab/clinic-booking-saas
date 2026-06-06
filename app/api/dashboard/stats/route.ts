import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "No org" }, { status: 400 })

  const orgId = userOrg.organizationId
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [revenue, expenses, receivables, payables, overdueInvoices, overdueBills] = await Promise.all([
    prisma.journalLine.aggregate({
      where: { journal: { organizationId: orgId, date: { gte: startOfMonth }, status: "POSTED" }, account: { accountType: "REVENUE" } },
      _sum: { credit: true },
    }),
    prisma.journalLine.aggregate({
      where: { journal: { organizationId: orgId, date: { gte: startOfMonth }, status: "POSTED" }, account: { accountType: "EXPENSE" } },
      _sum: { debit: true },
    }),
    prisma.invoice.aggregate({ where: { organizationId: orgId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } }, _sum: { amountDue: true }, _count: true }),
    prisma.bill.aggregate({ where: { organizationId: orgId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } }, _sum: { amountDue: true }, _count: true }),
    prisma.invoice.count({ where: { organizationId: orgId, status: { in: ["SENT", "PARTIAL"] }, dueDate: { lt: now } } }),
    prisma.bill.count({ where: { organizationId: orgId, status: { in: ["OPEN", "PARTIAL"] }, dueDate: { lt: now } } }),
  ])

  return NextResponse.json({
    revenue: Number(revenue._sum.credit || 0),
    expenses: Number(expenses._sum.debit || 0),
    netProfit: Number(revenue._sum.credit || 0) - Number(expenses._sum.debit || 0),
    receivables: { total: Number(receivables._sum.amountDue || 0), count: receivables._count, overdue: overdueInvoices },
    payables: { total: Number(payables._sum.amountDue || 0), count: payables._count, overdue: overdueBills },
  })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { round2 } from "@/lib/accounting"

export async function GET(req: NextRequest) {
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
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date(now.getFullYear(), 0, 1)
  const to   = searchParams.get("to")   ? new Date(searchParams.get("to")!)   : now
  to.setHours(23, 59, 59, 999)

  // Get all cost centers for this org
  const centers = await prisma.costCenter.findMany({
    where: { organizationId: orgId },
    include: { parent: { select: { name: true, code: true } } },
    orderBy: { code: "asc" },
  })

  // Aggregate journal lines by cost center within the period
  const lines = await prisma.journalLine.findMany({
    where: {
      costCenterId: { not: null },
      journal: {
        organizationId: orgId,
        date: { gte: from, lte: to },
        status: "POSTED",
      },
    },
    select: {
      costCenterId: true,
      debit:        true,
      credit:       true,
      account:      { select: { accountType: true, name: true } },
    },
  })

  // Group by cost center
  const byCenter = new Map<string, { debit: number; credit: number; expenseDebit: number; revenueCredit: number }>()
  for (const line of lines) {
    if (!line.costCenterId) continue
    const cur = byCenter.get(line.costCenterId) || { debit: 0, credit: 0, expenseDebit: 0, revenueCredit: 0 }
    cur.debit  = round2(cur.debit  + Number(line.debit))
    cur.credit = round2(cur.credit + Number(line.credit))
    if (line.account.accountType === "EXPENSE")  cur.expenseDebit   = round2(cur.expenseDebit  + Number(line.debit))
    if (line.account.accountType === "REVENUE")  cur.revenueCredit  = round2(cur.revenueCredit + Number(line.credit))
    byCenter.set(line.costCenterId, cur)
  }

  const rows = centers.map((cc) => {
    const agg = byCenter.get(cc.id) || { debit: 0, credit: 0, expenseDebit: 0, revenueCredit: 0 }
    return {
      id:            cc.id,
      code:          cc.code,
      name:          cc.name,
      parentName:    cc.parent ? `${cc.parent.code} ${cc.parent.name}` : null,
      isActive:      cc.isActive,
      totalDebit:    agg.debit,
      totalCredit:   agg.credit,
      expenses:      agg.expenseDebit,
      revenue:       agg.revenueCredit,
      netProfit:     round2(agg.revenueCredit - agg.expenseDebit),
    }
  })

  return NextResponse.json({
    rows,
    period: { from: from.toISOString(), to: to.toISOString() },
    currency: userOrg.organization.baseCurrency || "SAR",
    totals: {
      expenses:  round2(rows.reduce((s, r) => s + r.expenses,  0)),
      revenue:   round2(rows.reduce((s, r) => s + r.revenue,   0)),
      netProfit: round2(rows.reduce((s, r) => s + r.netProfit, 0)),
    },
  })
}

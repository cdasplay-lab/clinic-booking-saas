import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { round2 } from "@/lib/accounting"
import { getNextDocNumber } from "@/lib/org"
import { captureError } from "@/lib/logger"

/**
 * Year-end closing.
 * Zeros out all revenue and expense accounts into Retained Earnings,
 * then locks the fiscal year. After this the P&L for the year reads zero
 * (a fresh year) and the net result is carried into equity.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const orgId = userOrg.organizationId

  const fy = await prisma.fiscalYear.findFirst({
    where: { id: params.id, organizationId: orgId },
  })
  if (!fy) return NextResponse.json({ error: "السنة المالية غير موجودة" }, { status: 404 })
  if (fy.isClosed) return NextResponse.json({ error: "هذه السنة مقفلة مسبقاً" }, { status: 400 })

  try {
    // Pull all revenue & expense accounts with their lines inside the period
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId, accountType: { in: ["REVENUE", "EXPENSE"] } },
      include: {
        journalLines: {
          where: { journal: { organizationId: orgId, date: { gte: fy.startDate, lte: fy.endDate }, status: "POSTED" } },
        },
      },
    })

    const lines: Array<{ accountId: string; debit: number; credit: number; description: string }> = []
    let totalRevenue = 0
    let totalExpense = 0

    for (const acc of accounts) {
      const debit  = acc.journalLines.reduce((s, l) => s + Number(l.debit), 0)
      const credit = acc.journalLines.reduce((s, l) => s + Number(l.credit), 0)

      if (acc.accountType === "REVENUE") {
        const bal = round2(credit - debit) // natural credit balance
        if (Math.abs(bal) < 0.01) continue
        totalRevenue = round2(totalRevenue + bal)
        // Close: debit revenue by its balance
        lines.push({ accountId: acc.id, debit: bal, credit: 0, description: `إقفال ${acc.name}` })
      } else {
        const bal = round2(debit - credit) // natural debit balance
        if (Math.abs(bal) < 0.01) continue
        totalExpense = round2(totalExpense + bal)
        // Close: credit expense by its balance
        lines.push({ accountId: acc.id, debit: 0, credit: bal, description: `إقفال ${acc.name}` })
      }
    }

    if (lines.length === 0) {
      // Nothing to close — just lock the year
      await prisma.fiscalYear.update({ where: { id: fy.id }, data: { isClosed: true, closedAt: new Date() } })
      return NextResponse.json({ success: true, netProfit: 0, message: "لا توجد حركات لإقفالها — تم قفل السنة" })
    }

    const netProfit = round2(totalRevenue - totalExpense)

    // Retained earnings absorbs the net result
    let retained = await prisma.account.findFirst({ where: { organizationId: orgId, code: "3020" } })
    if (!retained) retained = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "EQUITY" } })
    if (!retained) return NextResponse.json({ error: "لا يوجد حساب أرباح مبقاة" }, { status: 400 })

    if (netProfit > 0) {
      lines.push({ accountId: retained.id, debit: 0, credit: netProfit, description: "صافي ربح السنة" })
    } else if (netProfit < 0) {
      lines.push({ accountId: retained.id, debit: -netProfit, credit: 0, description: "صافي خسارة السنة" })
    }

    const totalDebit  = round2(lines.reduce((s, l) => s + l.debit, 0))
    const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0))

    const number = await getNextDocNumber(orgId, "JOURNAL")
    await prisma.journal.create({
      data: {
        organizationId: orgId,
        fiscalYearId: fy.id,
        number,
        date: fy.endDate,
        type: "CLOSING",
        description: `قيد إقفال ${fy.name}`,
        status: "POSTED",
        totalDebit,
        totalCredit,
        lines: { create: lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description })) },
      },
    })

    await prisma.fiscalYear.update({ where: { id: fy.id }, data: { isClosed: true, closedAt: new Date() } })

    return NextResponse.json({ success: true, netProfit, totalRevenue, totalExpense })
  } catch (e: any) {
    captureError(e, { route: "fiscal-years.close", fyId: fy.id })
    return NextResponse.json({ error: "حدث خطأ في إقفال السنة" }, { status: 500 })
  }
}

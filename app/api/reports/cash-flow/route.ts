import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCountry } from "@/lib/countries"
import * as XLSX from "xlsx"
import { xlsxResponse } from "@/lib/excel"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { searchParams } = req.nextUrl
  const exportXlsx = searchParams.get("export") === "xlsx"

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), 0, 1)
  const defaultTo   = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : defaultFrom
  const to   = searchParams.get("to")   ? new Date(searchParams.get("to")!)   : defaultTo

  const orgId = userOrg.organizationId
  const country = getCountry(userOrg.organization.country)

  const payWhere = { organizationId: orgId, date: { gte: from, lte: to } }

  // ── Payments ──────────────────────────────────────────────────────────────
  const payments = await prisma.payment.findMany({
    where: payWhere,
    include: { invoice: { select: { number: true } }, bill: { select: { number: true } } },
  })

  // ── Payroll ───────────────────────────────────────────────────────────────
  const payrolls = await prisma.payrollRun.findMany({
    where: { organizationId: orgId, status: "PAID", payDate: { gte: from, lte: to } },
    select: { totalNet: true },
  })

  // ── Operating ─────────────────────────────────────────────────────────────
  const cashFromCustomers = payments
    .filter((p) => p.type === "INCOMING" && p.invoiceId)
    .reduce((s, p) => s + Number(p.amount), 0)

  const cashToSuppliers = payments
    .filter((p) => p.type === "OUTGOING" && p.billId)
    .reduce((s, p) => s + Number(p.amount), 0)

  const cashToPayroll = payrolls.reduce((s, p) => s + Number(p.totalNet), 0)

  const otherIncoming = payments
    .filter((p) => p.type === "INCOMING" && !p.invoiceId)
    .reduce((s, p) => s + Number(p.amount), 0)

  const otherOutgoing = payments
    .filter((p) => p.type === "OUTGOING" && !p.billId)
    .reduce((s, p) => s + Number(p.amount), 0)

  const operatingNet = cashFromCustomers + otherIncoming - cashToSuppliers - cashToPayroll - otherOutgoing

  // ── Investing ─────────────────────────────────────────────────────────────
  const assetPurchases = await prisma.journalLine.aggregate({
    where: {
      journal: { organizationId: orgId, date: { gte: from, lte: to } },
      account: { accountType: "FIXED_ASSET" },
      debit: { gt: 0 },
    },
    _sum: { debit: true },
  })
  const capitalExpenditure = Number(assetPurchases._sum.debit || 0)
  const investingNet = -capitalExpenditure

  // ── Financing ─────────────────────────────────────────────────────────────
  const equityCredits = await prisma.journalLine.aggregate({
    where: {
      journal: { organizationId: orgId, date: { gte: from, lte: to } },
      account: { accountType: "EQUITY" },
      credit: { gt: 0 },
    },
    _sum: { credit: true },
  })
  const loanRepayments = await prisma.journalLine.aggregate({
    where: {
      journal: { organizationId: orgId, date: { gte: from, lte: to } },
      account: { accountType: "LIABILITY" },
      debit: { gt: 0 },
    },
    _sum: { debit: true },
  })
  const equityInflows  = Number(equityCredits._sum.credit || 0)
  const loanPaid       = Number(loanRepayments._sum.debit || 0)
  const financingNet   = equityInflows - loanPaid

  // ── Opening cash (BANK + CASH journal lines before period) ────────────────
  const bankAccounts = await prisma.account.findMany({
    where: { organizationId: orgId, accountType: { in: ["BANK", "CASH"] } },
    select: { id: true },
  })
  const openingAgg = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: bankAccounts.map((a) => a.id) },
      journal: { organizationId: orgId, date: { lt: from } },
    },
    _sum: { debit: true, credit: true },
  })
  const openingCash = openingAgg.reduce(
    (s, l) => s + (Number(l._sum.debit) || 0) - (Number(l._sum.credit) || 0),
    0
  )

  const netChange    = operatingNet + investingNet + financingNet
  const closingCash  = openingCash + netChange

  // ── Monthly chart data (last 6 months) ────────────────────────────────────
  const monthlyData = []
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
    const mPay   = payments.filter((p) => p.date >= mStart && p.date <= mEnd)
    const inflow  = mPay.filter((p) => p.type === "INCOMING").reduce((s, p) => s + Number(p.amount), 0)
    const outflow = mPay.filter((p) => p.type === "OUTGOING").reduce((s, p) => s + Number(p.amount), 0)
    monthlyData.push({
      label: mStart.toLocaleDateString("ar-SA", { month: "short", year: "2-digit" }),
      inflow,
      outflow,
      net: inflow - outflow,
    })
  }

  const result = {
    period: { from: from.toISOString(), to: to.toISOString() },
    currency: country.currency,
    operating: {
      label: "أنشطة التشغيل",
      items: [
        { label: "نقد مستلم من العملاء",  amount: cashFromCustomers  },
        { label: "نقد مدفوع للموردين",    amount: -cashToSuppliers   },
        { label: "رواتب مدفوعة",           amount: -cashToPayroll     },
        ...(otherIncoming > 0  ? [{ label: "إيرادات نقدية أخرى",   amount: otherIncoming  }] : []),
        ...(otherOutgoing > 0  ? [{ label: "مصروفات نقدية أخرى",   amount: -otherOutgoing }] : []),
      ],
      net: operatingNet,
    },
    investing: {
      label: "أنشطة الاستثمار",
      items: [
        ...(capitalExpenditure > 0 ? [{ label: "شراء أصول ثابتة", amount: -capitalExpenditure }] : []),
      ],
      net: investingNet,
    },
    financing: {
      label: "أنشطة التمويل",
      items: [
        ...(equityInflows > 0 ? [{ label: "إسهامات رأس المال", amount: equityInflows }] : []),
        ...(loanPaid      > 0 ? [{ label: "سداد قروض",          amount: -loanPaid    }] : []),
      ],
      net: financingNet,
    },
    summary: { openingCash, netChange, closingCash },
    chart: monthlyData,
  }

  if (exportXlsx) {
    const rows: any[][] = [
      ["قائمة التدفق النقدي"],
      [`من: ${from.toLocaleDateString("ar")}   إلى: ${to.toLocaleDateString("ar")}`],
      [],
      ["البند", "المبلغ (" + country.currency + ")"],
      ["أنشطة التشغيل"],
      ...result.operating.items.map((i) => ["  " + i.label, i.amount]),
      ["صافي التشغيل", operatingNet],
      [],
      ["أنشطة الاستثمار"],
      ...(result.investing.items.length ? result.investing.items.map((i) => ["  " + i.label, i.amount]) : [["  لا توجد حركات", 0]]),
      ["صافي الاستثمار", investingNet],
      [],
      ["أنشطة التمويل"],
      ...(result.financing.items.length ? result.financing.items.map((i) => ["  " + i.label, i.amount]) : [["  لا توجد حركات", 0]]),
      ["صافي التمويل", financingNet],
      [],
      ["رصيد النقد الافتتاحي", openingCash],
      ["صافي التغيير في النقد", netChange],
      ["رصيد النقد الختامي", closingCash],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws["!cols"] = [{ wch: 40 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, "التدفق النقدي")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    return xlsxResponse(buf, `cash-flow`)
  }

  return NextResponse.json(result)
}

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getCountry } from "@/lib/countries"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Minus, Download, Wallet } from "lucide-react"
import CashFlowChart from "@/components/reports/cash-flow-chart"
import Link from "next/link"

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const country = getCountry(userOrg.organization.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  const now   = new Date()
  const from  = searchParams.from || `${now.getFullYear()}-01-01`
  const to    = searchParams.to   || `${now.getFullYear()}-12-31`

  // Fetch data from our own API
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  let data: any = null
  try {
    const res = await fetch(`${appUrl}/api/reports/cash-flow?from=${from}&to=${to}`, {
      cache: "no-store",
      headers: { cookie: "" }, // server-to-server without auth — we'll query directly below
    })
    if (!res.ok) throw new Error("fetch failed")
    data = await res.json()
  } catch {
    // Fallback: query directly
    data = await buildCashFlowDirect(userOrg.organizationId, new Date(from), new Date(to), country)
  }

  const { operating, investing, financing, summary, chart } = data

  function sectionColor(net: number) {
    if (net > 0) return "text-green-700"
    if (net < 0) return "text-red-600"
    return "text-gray-600"
  }

  function SectionIcon({ net }: { net: number }) {
    if (net > 0) return <TrendingUp className="h-5 w-5 text-green-600" />
    if (net < 0) return <TrendingDown className="h-5 w-5 text-red-500" />
    return <Minus className="h-5 w-5 text-gray-400" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-blue-600" />
            قائمة التدفق النقدي
          </h1>
          <p className="text-sm text-gray-500">العملة: {country.currency} · {country.flag} {country.nameAr}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date filter */}
          <form className="flex items-center gap-2">
            <input type="date" name="from" defaultValue={from}
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" name="to" defaultValue={to}
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <Button type="submit" size="sm" variant="outline">تطبيق</Button>
          </form>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/reports/cash-flow?from=${from}&to=${to}&export=xlsx`} download>
              <Download className="h-4 w-4" /> Excel
            </a>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="رصيد الافتتاح"
          value={fmt(summary.openingCash)}
          sub="بداية الفترة"
          color="bg-gray-50 border-gray-200"
          textColor="text-gray-700"
        />
        <SummaryCard
          label="صافي التغيير"
          value={fmt(summary.netChange)}
          sub={summary.netChange >= 0 ? "تحسّن" : "انخفاض"}
          color={summary.netChange >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}
          textColor={summary.netChange >= 0 ? "text-green-700" : "text-red-700"}
        />
        <SummaryCard
          label="رصيد الختام"
          value={fmt(summary.closingCash)}
          sub="نهاية الفترة"
          color="bg-blue-50 border-blue-200"
          textColor="text-blue-700"
        />
        <SummaryCard
          label="صافي التشغيل"
          value={fmt(operating.net)}
          sub="الأنشطة التشغيلية"
          color={operating.net >= 0 ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}
          textColor={operating.net >= 0 ? "text-green-700" : "text-orange-700"}
        />
      </div>

      {/* Chart */}
      {chart && chart.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">التدفق النقدي — آخر 6 أشهر</p>
            <CashFlowChart data={chart} currency={country.currency} />
          </CardContent>
        </Card>
      )}

      {/* Three sections */}
      <div className="grid lg:grid-cols-3 gap-4">
        {[operating, investing, financing].map((section) => (
          <Card key={section.label} className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
              <p className="font-bold text-sm">{section.label}</p>
              <SectionIcon net={section.net} />
            </div>
            <CardContent className="p-4 space-y-2">
              {section.items.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">لا توجد حركات في هذه الفترة</p>
              ) : (
                section.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{item.label}</span>
                    <span className={`font-medium ${item.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {item.amount >= 0 ? "+" : ""}{fmt(item.amount)}
                    </span>
                  </div>
                ))
              )}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span className="text-sm">الصافي</span>
                <span className={`text-sm ${sectionColor(section.net)}`}>
                  {section.net >= 0 ? "+" : ""}{fmt(section.net)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Waterfall summary */}
      <Card>
        <CardContent className="p-4">
          <p className="font-bold text-sm mb-3">ملخص التدفق النقدي</p>
          <div className="space-y-2 text-sm">
            {[
              { label: "رصيد النقد الافتتاحي",      value: summary.openingCash, highlight: false },
              { label: "+ صافي أنشطة التشغيل",       value: operating.net,       highlight: false },
              { label: "+ صافي أنشطة الاستثمار",     value: investing.net,       highlight: false },
              { label: "+ صافي أنشطة التمويل",       value: financing.net,       highlight: false },
              { label: "= رصيد النقد الختامي",       value: summary.closingCash, highlight: true  },
            ].map((row, i) => (
              <div
                key={i}
                className={`flex justify-between px-3 py-2 rounded ${row.highlight ? "bg-blue-50 font-bold" : "hover:bg-gray-50"}`}
              >
                <span className={row.highlight ? "text-blue-800" : "text-gray-600"}>{row.label}</span>
                <span className={`font-medium ${row.highlight ? "text-blue-700" : row.value >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {row.value >= 0 ? "+" : ""}{fmt(row.value)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  label, value, sub, color, textColor,
}: { label: string; value: string; sub: string; color: string; textColor: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

// Direct DB fallback (used when internal fetch fails)
async function buildCashFlowDirect(orgId: string, from: Date, to: Date, country: any) {
  const payments = await prisma.payment.findMany({
    where: { organizationId: orgId, date: { gte: from, lte: to } },
  })
  const payrolls = await prisma.payrollRun.findMany({
    where: { organizationId: orgId, status: "PAID", payDate: { gte: from, lte: to } },
    select: { totalNet: true },
  })

  const cashIn  = payments.filter((p) => p.type === "INCOMING").reduce((s, p) => s + Number(p.amount), 0)
  const cashOut = payments.filter((p) => p.type === "OUTGOING").reduce((s, p) => s + Number(p.amount), 0)
  const payroll = payrolls.reduce((s, p) => s + Number(p.totalNet), 0)

  const now = new Date()
  const chart = Array.from({ length: 6 }, (_, i) => {
    const mStart = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const mEnd   = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0)
    const mPay   = payments.filter((p) => p.date >= mStart && p.date <= mEnd)
    const inflow  = mPay.filter((p) => p.type === "INCOMING").reduce((s, p) => s + Number(p.amount), 0)
    const outflow = mPay.filter((p) => p.type === "OUTGOING").reduce((s, p) => s + Number(p.amount), 0)
    return { label: mStart.toLocaleDateString("ar-SA", { month: "short", year: "2-digit" }), inflow, outflow, net: inflow - outflow }
  })

  const operatingNet = cashIn - cashOut - payroll
  return {
    currency: country.currency,
    operating: {
      label: "أنشطة التشغيل",
      items: [
        { label: "نقد مستلم من العملاء", amount: cashIn },
        { label: "نقد مدفوع (مصروفات)", amount: -cashOut },
        ...(payroll > 0 ? [{ label: "رواتب مدفوعة", amount: -payroll }] : []),
      ],
      net: operatingNet,
    },
    investing:  { label: "أنشطة الاستثمار", items: [], net: 0 },
    financing:  { label: "أنشطة التمويل",   items: [], net: 0 },
    summary:    { openingCash: 0, netChange: operatingNet, closingCash: operatingNet },
    chart,
  }
}

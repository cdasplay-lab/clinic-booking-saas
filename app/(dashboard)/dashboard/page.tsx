import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import DashboardCharts from "@/components/dashboard/charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  CheckCircle2, ArrowUpRight
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const orgId = userOrg.organizationId
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Fetch key metrics in parallel
  const [
    totalRevenue,
    totalExpenses,
    overdueInvoices,
    overdueBills,
    recentJournals,
    cashBalance,
    receivables,
    payables,
  ] = await Promise.all([
    // Revenue this month
    prisma.journalLine.aggregate({
      where: {
        journal: {
          organizationId: orgId,
          date: { gte: startOfMonth },
          status: "POSTED",
        },
        account: { accountType: "REVENUE" },
      },
      _sum: { credit: true },
    }),
    // Expenses this month
    prisma.journalLine.aggregate({
      where: {
        journal: {
          organizationId: orgId,
          date: { gte: startOfMonth },
          status: "POSTED",
        },
        account: { accountType: "EXPENSE" },
      },
      _sum: { debit: true },
    }),
    // Overdue invoices
    prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
        dueDate: { lt: now },
      },
      include: { contact: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    // Overdue bills
    prisma.bill.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["OPEN", "PARTIAL", "OVERDUE"] },
        dueDate: { lt: now },
      },
      include: { contact: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    // Recent journal entries
    prisma.journal.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    // Cash + Bank balance
    prisma.journalLine.aggregate({
      where: {
        journal: { organizationId: orgId, status: "POSTED" },
        account: { accountType: { in: ["CASH", "BANK"] } },
      },
      _sum: { debit: true, credit: true },
    }),
    // Total receivables
    prisma.invoice.aggregate({
      where: { organizationId: orgId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      _sum: { amountDue: true },
    }),
    // Total payables
    prisma.bill.aggregate({
      where: { organizationId: orgId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
      _sum: { amountDue: true },
    }),
  ])

  const revenue = Number(totalRevenue._sum.credit || 0)
  const expenses = Number(totalExpenses._sum.debit || 0)
  const cash = Number(cashBalance._sum.debit || 0) - Number(cashBalance._sum.credit || 0)
  const receivablesTotal = Number(receivables._sum.amountDue || 0)
  const payablesTotal = Number(payables._sum.amountDue || 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
        <p className="text-gray-500 text-sm">مرحباً، {session.user.name} - هذا ملخص وضع شركتك المالي</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-r-4 border-r-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">الإيرادات هذا الشهر</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue)}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">المصروفات هذا الشهر</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(expenses)}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">الرصيد النقدي</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(cash)}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">صافي الربح</p>
                <p className={`text-2xl font-bold ${revenue - expenses >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(revenue - expenses)}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <ArrowUpRight className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <DashboardCharts />

      {/* AR/AP Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">المبالغ المستحقة (من العملاء)</CardTitle>
              <Badge variant={overdueInvoices.length > 0 ? "destructive" : "secondary"}>
                {overdueInvoices.length} متأخرة
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600 mb-3">{formatCurrency(receivablesTotal)}</p>
            <div className="space-y-2">
              {overdueInvoices.slice(0, 3).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-gray-700">{inv.contact.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(Number(inv.amountDue))}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3" asChild>
              <Link href="/dashboard/invoices">عرض كل الفواتير</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">المبالغ المستحقة (للموردين)</CardTitle>
              <Badge variant={overdueBills.length > 0 ? "destructive" : "secondary"}>
                {overdueBills.length} متأخرة
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600 mb-3">{formatCurrency(payablesTotal)}</p>
            <div className="space-y-2">
              {overdueBills.slice(0, 3).map((bill) => (
                <div key={bill.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-gray-700">{bill.contact.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(Number(bill.amountDue))}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3" asChild>
              <Link href="/dashboard/bills">عرض كل فواتير الموردين</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>آخر القيود المحاسبية</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/journals">عرض الكل</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentJournals.length === 0 ? (
              <p className="text-center text-gray-500 py-4">لا توجد قيود بعد</p>
            ) : (
              recentJournals.map((j) => (
                <div key={j.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">{j.description}</p>
                      <p className="text-xs text-gray-500">
                        {j.number} · {new Date(j.date).toLocaleDateString("ar-SA")}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(Number(j.totalDebit))}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

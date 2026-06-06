import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getProfitAndLoss } from "@/lib/accounting"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ProfitLossPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const data = await getProfitAndLoss(userOrg.organizationId, startOfYear, now)

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">قائمة الأرباح والخسائر</h1>
        <p className="text-sm text-gray-500">
          {userOrg.organization.name} · من {startOfYear.toLocaleDateString("ar-SA")} إلى {now.toLocaleDateString("ar-SA")}
        </p>
      </div>

      <Card>
        <CardHeader className="bg-green-50 rounded-t-lg">
          <CardTitle className="text-green-800">الإيرادات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.revenues.map((a: any) => (
              <div key={a.id} className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-gray-700">{a.name}</span>
                <span className="text-sm font-medium text-green-700">{formatCurrency(a.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-green-50 font-bold text-green-800">
              <span>إجمالي الإيرادات</span>
              <span>{formatCurrency(data.totalRevenue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-red-50 rounded-t-lg">
          <CardTitle className="text-red-800">المصروفات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.expenses.map((a: any) => (
              <div key={a.id} className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-gray-700">{a.name}</span>
                <span className="text-sm font-medium text-red-700">{formatCurrency(a.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-red-50 font-bold text-red-800">
              <span>إجمالي المصروفات</span>
              <span>{formatCurrency(data.totalExpenses)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={`p-6 rounded-lg text-center ${data.netProfit >= 0 ? "bg-green-100" : "bg-red-100"}`}>
        <p className="text-sm text-gray-600 mb-1">صافي {data.netProfit >= 0 ? "الربح" : "الخسارة"}</p>
        <p className={`text-4xl font-bold ${data.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
          {formatCurrency(Math.abs(data.netProfit))}
        </p>
        <p className="text-sm mt-2 text-gray-500">
          هامش الربح: {data.totalRevenue > 0 ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1) : 0}%
        </p>
      </div>
    </div>
  )
}

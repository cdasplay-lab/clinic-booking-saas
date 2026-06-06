import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getBalanceSheet } from "@/lib/accounting"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function BalanceSheetPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const asOfDate = new Date()
  const data = await getBalanceSheet(userOrg.organizationId, asOfDate)

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">الميزانية العمومية</h1>
        <p className="text-sm text-gray-500">
          {userOrg.organization.name} · حتى {asOfDate.toLocaleDateString("ar-SA")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assets */}
        <Card>
          <CardHeader className="bg-blue-50 rounded-t-lg">
            <CardTitle className="text-blue-800">الأصول</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.assets.map((a) => (
                <div key={a.id} className="flex justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-700">{a.name}</span>
                  <span className="text-sm font-medium">{formatCurrency(a.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-3 bg-blue-50 font-bold">
                <span>إجمالي الأصول</span>
                <span className="text-blue-700">{formatCurrency(data.totalAssets)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liabilities + Equity */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="bg-red-50 rounded-t-lg">
              <CardTitle className="text-red-800">الخصوم</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.liabilities.map((a) => (
                  <div key={a.id} className="flex justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">{a.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(a.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-3 bg-red-50 font-bold">
                  <span>إجمالي الخصوم</span>
                  <span className="text-red-700">{formatCurrency(data.totalLiabilities)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-green-50 rounded-t-lg">
              <CardTitle className="text-green-800">حقوق الملكية</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.equity.map((a) => (
                  <div key={a.id} className="flex justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">{a.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(a.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-3 bg-green-50 font-bold">
                  <span>إجمالي حقوق الملكية</span>
                  <span className="text-green-700">{formatCurrency(data.totalEquity)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className={`p-4 rounded-lg font-bold text-center ${
            Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) < 1
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}>
            {Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) < 1
              ? "✓ الميزانية متوازنة"
              : `⚠ فرق: ${formatCurrency(Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)))}`}
          </div>
        </div>
      </div>
    </div>
  )
}

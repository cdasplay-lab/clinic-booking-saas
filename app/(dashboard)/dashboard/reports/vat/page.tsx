import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

export default async function VATReportPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  const startMonth = (quarter - 1) * 3
  const startDate = new Date(now.getFullYear(), startMonth, 1)
  const endDate = new Date(now.getFullYear(), startMonth + 3, 0)

  const [salesTax, purchaseTax] = await Promise.all([
    prisma.invoiceItem.aggregate({
      where: {
        invoice: {
          organizationId: userOrg.organizationId,
          date: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
        },
      },
      _sum: { taxAmount: true, total: true },
    }),
    prisma.billItem.aggregate({
      where: {
        bill: {
          organizationId: userOrg.organizationId,
          date: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
        },
      },
      _sum: { taxAmount: true, total: true },
    }),
  ])

  const outputVAT = Number(salesTax._sum.taxAmount || 0)
  const inputVAT = Number(purchaseTax._sum.taxAmount || 0)
  const netVAT = outputVAT - inputVAT

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">تقرير ضريبة القيمة المضافة</h1>
        <p className="text-sm text-gray-500">
          {userOrg.organization.name} · الربع {quarter} من {now.getFullYear()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="border-r-4 border-r-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-700">ضريبة المخرجات (على المبيعات)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">إجمالي المبيعات</p>
            <p className="text-xl font-bold">{formatCurrency(Number(salesTax._sum.total || 0))}</p>
            <p className="text-sm text-gray-500 mt-2">ضريبة القيمة المضافة (15%)</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(outputVAT)}</p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-blue-700">ضريبة المدخلات (على المشتريات)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">إجمالي المشتريات</p>
            <p className="text-xl font-bold">{formatCurrency(Number(purchaseTax._sum.total || 0))}</p>
            <p className="text-sm text-gray-500 mt-2">ضريبة القيمة المضافة (15%)</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(inputVAT)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className={netVAT > 0 ? "border-2 border-orange-400 bg-orange-50" : "border-2 border-green-400 bg-green-50"}>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-gray-600 mb-2">
            {netVAT > 0 ? "ضريبة مستحقة الدفع للهيئة" : "ضريبة مستردة من الهيئة"}
          </p>
          <p className={`text-4xl font-bold ${netVAT > 0 ? "text-orange-600" : "text-green-600"}`}>
            {formatCurrency(Math.abs(netVAT))}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {netVAT > 0
              ? `يجب دفع هذا المبلغ لهيئة الزكاة والضريبة`
              : `يمكن استرداد هذا المبلغ من هيئة الزكاة والضريبة`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ملخص الفترة</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span>الفترة</span>
              <span className="font-medium">الربع {quarter} ({startDate.toLocaleDateString("ar-SA")} - {endDate.toLocaleDateString("ar-SA")})</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>إجمالي المبيعات الخاضعة للضريبة</span>
              <span className="font-medium">{formatCurrency(Number(salesTax._sum.total || 0))}</span>
            </div>
            <div className="flex justify-between border-b pb-2 text-green-700">
              <span>ضريبة المخرجات</span>
              <span className="font-medium">{formatCurrency(outputVAT)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>إجمالي المشتريات الخاضعة للضريبة</span>
              <span className="font-medium">{formatCurrency(Number(purchaseTax._sum.total || 0))}</span>
            </div>
            <div className="flex justify-between border-b pb-2 text-blue-700">
              <span>ضريبة المدخلات</span>
              <span className="font-medium">{formatCurrency(inputVAT)}</span>
            </div>
            <div className={`flex justify-between font-bold text-lg ${netVAT > 0 ? "text-orange-600" : "text-green-600"}`}>
              <span>صافي الضريبة</span>
              <span>{formatCurrency(Math.abs(netVAT))} {netVAT > 0 ? "(مستحقة)" : "(مستردة)"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

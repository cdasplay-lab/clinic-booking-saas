import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { RecordDepreciationButton } from "@/components/fixed-assets/record-depreciation-button"

const methodLabels: Record<string, string> = {
  STRAIGHT_LINE:     "القسط الثابت",
  DECLINING_BALANCE: "القسط المتناقص",
  SUM_OF_YEARS:      "مجموع السنوات",
}

export default async function FixedAssetDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const asset = await prisma.fixedAsset.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { depreciations: { orderBy: { date: "desc" } } },
  })
  if (!asset) notFound()

  const accumulatedDepreciation = Number(asset.purchasePrice) - Number(asset.currentValue)
  const annualDepreciation = (Number(asset.purchasePrice) - Number(asset.salvageValue)) / asset.usefulLife
  const monthlyDepreciation = annualDepreciation / 12

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/fixed-assets"><ArrowRight className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{asset.name}</h1>
            <Badge variant={asset.status === "ACTIVE" ? "success" : asset.status === "DISPOSED" ? "secondary" : "warning"}>
              {asset.status === "ACTIVE" ? "نشط" : asset.status === "DISPOSED" ? "مُستبعد" : "صيانة"}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">{asset.code} · {asset.category}</p>
        </div>
        {asset.status === "ACTIVE" && (
          <RecordDepreciationButton
            assetId={asset.id}
            suggestedAmount={monthlyDepreciation}
            currentValue={Number(asset.currentValue)}
          />
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "تكلفة الشراء",      value: formatCurrency(Number(asset.purchasePrice)) },
          { label: "القيمة الحالية",     value: formatCurrency(Number(asset.currentValue)), highlight: true },
          { label: "قيمة الإنقاذ",       value: formatCurrency(Number(asset.salvageValue)) },
          { label: "العمر الإنتاجي",     value: `${asset.usefulLife} سنة` },
          { label: "طريقة الإهلاك",      value: methodLabels[asset.depreciationMethod] },
          { label: "تاريخ الشراء",        value: formatDateShort(asset.purchaseDate) },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-lg border p-3">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className={`font-medium mt-0.5 ${item.highlight ? "text-blue-600" : ""}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Depreciation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">مجمع الإهلاك</p>
          <p className="text-xl font-bold text-amber-800">{formatCurrency(accumulatedDepreciation)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">الإهلاك السنوي</p>
          <p className="text-xl font-bold">{formatCurrency(annualDepreciation)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">الإهلاك الشهري</p>
          <p className="text-xl font-bold">{formatCurrency(monthlyDepreciation)}</p>
        </div>
      </div>

      {/* Depreciation History */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold">سجل الإهلاك</h2>
          <span className="text-sm text-gray-500">{asset.depreciations.length} قيد</span>
        </div>
        {asset.depreciations.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            لم يتم تسجيل أي إهلاك بعد
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-left">مبلغ الإهلاك</TableHead>
                <TableHead className="text-left">القيمة الدفترية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asset.depreciations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-gray-500 text-sm">{formatDateShort(d.date)}</TableCell>
                  <TableCell className="text-left text-amber-600 font-medium">{formatCurrency(Number(d.amount))}</TableCell>
                  <TableCell className="text-left font-medium">{formatCurrency(Number(d.bookValue))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

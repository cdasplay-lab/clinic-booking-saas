import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Briefcase } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"

export default async function FixedAssetsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const assets = await prisma.fixedAsset.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { depreciations: { orderBy: { date: "desc" }, take: 1 } },
    orderBy: { purchaseDate: "desc" },
  })

  const totalValue = assets.filter((a) => a.status === "ACTIVE").reduce((s, a) => s + Number(a.currentValue), 0)

  const methodLabels: Record<string, string> = {
    STRAIGHT_LINE: "القسط الثابت",
    DECLINING_BALANCE: "القسط المتناقص",
    SUM_OF_YEARS: "مجموع السنوات",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الأصول الثابتة</h1>
          <p className="text-sm text-gray-500">إجمالي القيمة الدفترية: {formatCurrency(totalValue)}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/fixed-assets/new">
            <Plus className="h-4 w-4" />
            أصل ثابت جديد
          </Link>
        </Button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>تاريخ الشراء</TableHead>
              <TableHead className="text-left">تكلفة الشراء</TableHead>
              <TableHead className="text-left">القيمة الحالية</TableHead>
              <TableHead>طريقة الإهلاك</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  لا توجد أصول ثابتة بعد
                </TableCell>
              </TableRow>
            ) : (
              assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.category}</TableCell>
                  <TableCell>{formatDateShort(a.purchaseDate)}</TableCell>
                  <TableCell className="text-left">{formatCurrency(Number(a.purchasePrice))}</TableCell>
                  <TableCell className="text-left">{formatCurrency(Number(a.currentValue))}</TableCell>
                  <TableCell className="text-sm">{methodLabels[a.depreciationMethod]}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "ACTIVE" ? "success" : a.status === "DISPOSED" ? "secondary" : "warning"}>
                      {a.status === "ACTIVE" ? "نشط" : a.status === "DISPOSED" ? "مُستبعد" : "صيانة"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

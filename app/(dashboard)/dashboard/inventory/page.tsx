import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Package, AlertTriangle, ClipboardList } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function InventoryPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const products = await prisma.product.findMany({
    where: { organizationId: userOrg.organizationId, isActive: true },
    include: {
      stockLedger: true,
    },
    orderBy: { name: "asc" },
  })

  const productsWithStock = products.map((p) => {
    const currentStock = p.stockLedger.reduce((sum, s) => {
      if (s.type === "IN")         return sum + Number(s.quantity)
      if (s.type === "OUT")        return sum - Number(s.quantity)
      if (s.type === "ADJUSTMENT") return sum + Number(s.quantity) // signed delta
      return sum
    }, 0)
    return { ...p, currentStock }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة المخزون</h1>
          <p className="text-sm text-gray-500">{products.length} منتج</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/inventory/adjust">
              <ClipboardList className="h-4 w-4" />
              جرد المخزون
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/inventory/new">
              <Plus className="h-4 w-4" />
              منتج جديد
            </Link>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>المنتج</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead className="text-left">سعر البيع</TableHead>
              <TableHead className="text-left">سعر الشراء</TableHead>
              <TableHead className="text-left">المخزون الحالي</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsWithStock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  لا توجد منتجات بعد
                </TableCell>
              </TableRow>
            ) : (
              productsWithStock.map((p) => {
                const isLow = p.currentStock <= Number(p.reorderLevel) && p.isInventoried
                return (
                  <TableRow key={p.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-sm">{p.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/inventory/${p.id}`} className="hover:underline text-blue-600">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>{p.category || "-"}</TableCell>
                    <TableCell className="text-left">{formatCurrency(Number(p.salePrice))}</TableCell>
                    <TableCell className="text-left">{formatCurrency(Number(p.purchasePrice))}</TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center gap-2">
                        {isLow && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                        <span className={isLow ? "text-orange-600 font-medium" : ""}>
                          {p.currentStock} {p.unit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isLow ? "destructive" : "success"}>
                        {isLow ? "منخفض" : "متوفر"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

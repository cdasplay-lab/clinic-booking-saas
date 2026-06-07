import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Package } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"
import { ConvertOrderButton } from "@/components/orders/convert-order-button"

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: "مسودة",           color: "bg-gray-100 text-gray-700" },
  SENT:      { label: "مرسل",            color: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "مؤكد",            color: "bg-indigo-100 text-indigo-700" },
  PARTIAL:   { label: "استلام جزئي",     color: "bg-yellow-100 text-yellow-700" },
  RECEIVED:  { label: "مستلم بالكامل",   color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغى",             color: "bg-red-100 text-red-700" },
}

export default async function PurchaseOrdersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const orders = await prisma.purchaseOrder.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: { select: { name: true } } },
    orderBy: { date: "desc" },
  })

  const totals = {
    draft:    orders.filter((o) => o.status === "DRAFT").length,
    sent:     orders.filter((o) => o.status === "SENT").length,
    received: orders.filter((o) => o.status === "RECEIVED").length,
    value:    orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + Number(o.total), 0),
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="لا توجد أوامر شراء"
        description="أنشئ أوامر شراء لتتبع طلباتك من الموردين واستلام البضائع."
        href="/dashboard/purchase-orders/new"
        ctaLabel="إنشاء أمر شراء جديد"
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">أوامر الشراء</h1>
          <p className="text-sm text-gray-500">{orders.length} أمر</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/purchase-orders/new">
            <Plus className="h-4 w-4 ml-1" /> أمر شراء جديد
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "مسودات",           value: totals.draft,    color: "text-gray-600",  isCount: true },
          { label: "مرسلة",             value: totals.sent,     color: "text-blue-600",  isCount: true },
          { label: "مستلمة",            value: totals.received, color: "text-green-600", isCount: true },
          { label: "إجمالي القيمة",     value: totals.value,    color: "text-blue-700",  isCount: false },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>
              {s.isCount ? s.value : formatCurrency(s.value as number)}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الأمر</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>موعد الاستلام</TableHead>
              <TableHead className="text-left">الإجمالي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const cfg = statusConfig[order.status] || statusConfig.DRAFT
              const canConvert = !["RECEIVED", "CANCELLED"].includes(order.status)
              return (
                <TableRow key={order.id} className="hover:bg-gray-50">
                  <TableCell className="font-mono text-sm font-medium text-blue-600">
                    <Link href={`/dashboard/purchase-orders/${order.id}`} className="hover:underline">
                      {order.number}
                    </Link>
                  </TableCell>
                  <TableCell>{order.contact.name}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{formatDateShort(order.date)}</TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {order.expectedDate ? formatDateShort(order.expectedDate) : "—"}
                  </TableCell>
                  <TableCell className="text-left font-medium">
                    {formatCurrency(Number(order.total))}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ConvertOrderButton orderId={order.id} orderType="po" disabled={!canConvert} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

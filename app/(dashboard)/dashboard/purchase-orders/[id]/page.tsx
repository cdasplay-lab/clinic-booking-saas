import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { ConvertOrderButton } from "@/components/orders/convert-order-button"
import { OrderStatusButton } from "@/components/orders/order-status-button"

const statusConfig: Record<string, { label: string; variant: any }> = {
  DRAFT:     { label: "مسودة",           variant: "secondary" },
  SENT:      { label: "مرسل",            variant: "default" },
  CONFIRMED: { label: "مؤكد",            variant: "default" },
  PARTIAL:   { label: "استلام جزئي",     variant: "warning" },
  RECEIVED:  { label: "مستلم بالكامل",   variant: "success" },
  CANCELLED: { label: "ملغى",             variant: "destructive" },
}

const nextStatuses: Record<string, { value: string; label: string }[]> = {
  DRAFT:     [{ value: "SENT",      label: "إرسال للمورد" }, { value: "CANCELLED", label: "إلغاء" }],
  SENT:      [{ value: "CONFIRMED", label: "تأكيد الأمر" }, { value: "CANCELLED", label: "إلغاء" }],
  CONFIRMED: [{ value: "RECEIVED",  label: "استلام كامل" }, { value: "CANCELLED", label: "إلغاء" }],
  PARTIAL:   [{ value: "RECEIVED",  label: "استلام كامل" }],
  RECEIVED:  [],
  CANCELLED: [],
}

export default async function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: {
      contact: true,
      items:   { include: { product: { select: { name: true, code: true } } } },
    },
  })
  if (!order) notFound()

  const cfg       = statusConfig[order.status] || statusConfig.DRAFT
  const actions   = nextStatuses[order.status] || []
  const canConvert = !["RECEIVED", "CANCELLED"].includes(order.status)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/purchase-orders"><ArrowRight className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{order.number}</h1>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
          <p className="text-sm text-gray-500">{order.contact.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {actions.map((a) => (
            <OrderStatusButton
              key={a.value}
              orderId={order.id}
              orderType="po"
              newStatus={a.value}
              label={a.label}
              variant={a.value === "CANCELLED" ? "destructive" : "outline"}
            />
          ))}
          {canConvert && (
            <ConvertOrderButton orderId={order.id} orderType="po" />
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "تاريخ الأمر",    value: formatDateShort(order.date) },
          { label: "موعد الاستلام",  value: order.expectedDate ? formatDateShort(order.expectedDate) : "—" },
          { label: "العملة",          value: order.currency },
          { label: "الإجمالي",        value: formatCurrency(Number(order.total)) },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-lg border p-3">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className="font-medium mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">البنود</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الوصف</TableHead>
              <TableHead className="text-left">الكمية</TableHead>
              <TableHead className="text-left">سعر الوحدة</TableHead>
              <TableHead className="text-left">الإجمالي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-medium">{item.description}</p>
                  {item.product && (
                    <p className="text-xs text-gray-400">{item.product.code}</p>
                  )}
                </TableCell>
                <TableCell className="text-left">{Number(item.quantity).toLocaleString("ar-SA")}</TableCell>
                <TableCell className="text-left">{formatCurrency(Number(item.unitPrice))}</TableCell>
                <TableCell className="text-left font-medium">{formatCurrency(Number(item.total))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Totals */}
        <div className="border-t px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-500">
            <span>المجموع الجزئي</span>
            <span>{formatCurrency(Number(order.subtotal))}</span>
          </div>
          {Number(order.taxAmount) > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>الضريبة</span>
              <span>{formatCurrency(Number(order.taxAmount))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1 border-t">
            <span>الإجمالي</span>
            <span>{formatCurrency(Number(order.total))}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-700 mb-1">ملاحظات</p>
          <p className="text-sm text-gray-500 whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}
    </div>
  )
}

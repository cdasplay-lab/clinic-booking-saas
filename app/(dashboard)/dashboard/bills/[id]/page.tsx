import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import AttachmentPanel from "@/components/attachments/attachment-panel"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { ArrowRight, FilePlus2 } from "lucide-react"
import Link from "next/link"

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: "مسودة",            color: "bg-gray-100 text-gray-700" },
  OPEN:      { label: "مفتوحة",           color: "bg-blue-100 text-blue-700" },
  PARTIAL:   { label: "مدفوع جزئياً",     color: "bg-yellow-100 text-yellow-700" },
  PAID:      { label: "مدفوعة",           color: "bg-green-100 text-green-700" },
  OVERDUE:   { label: "متأخرة",           color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "ملغاة",            color: "bg-gray-100 text-gray-500" },
}

export default async function BillDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const bill = await prisma.bill.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { contact: true, items: { include: { taxRate: true } } },
  })
  if (!bill) notFound()

  const org = userOrg.organization
  const country = getCountry(org.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  const isOverdue = bill.dueDate < new Date() && ["OPEN", "PARTIAL"].includes(bill.status)
  const displayStatus = isOverdue ? "OVERDUE" : bill.status
  const status = statusConfig[displayStatus] || statusConfig.DRAFT

  const hasVat = country.vatEnabled && Number(bill.taxAmount) > 0

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/bills"><ArrowRight className="h-4 w-4" /> فواتير الموردين</Link>
        </Button>
        {["OPEN", "PARTIAL", "PAID"].includes(bill.status) && (
          <Button variant="outline" size="sm" className="text-purple-600 border-purple-200 hover:bg-purple-50" asChild>
            <Link href={`/dashboard/debit-notes/new?billId=${params.id}`}>
              <FilePlus2 className="h-4 w-4 ml-1" />إشعار إضافة
            </Link>
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{org.name}</h1>
              {org.address && <p className="text-purple-200 text-sm mt-1">{org.address}</p>}
              {org.phone && <p className="text-purple-200 text-sm">{org.phone}</p>}
            </div>
            <div className="text-left">
              <p className="text-3xl font-bold">فاتورة مورد</p>
              <p className="text-purple-200 text-lg font-mono">{bill.number}</p>
              {bill.vendorRef && <p className="text-purple-200 text-sm">مرجع المورد: {bill.vendorRef}</p>}
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">المورد:</p>
              <p className="font-bold text-lg">{bill.contact.name}</p>
              {bill.contact.taxNumber && <p className="text-sm text-gray-500">رقم ضريبي: {bill.contact.taxNumber}</p>}
              {bill.contact.address && <p className="text-sm text-gray-500">{bill.contact.address}</p>}
              {bill.contact.phone && <p className="text-sm text-gray-500">{bill.contact.phone}</p>}
            </div>
            <div className="text-left space-y-2">
              <div>
                <p className="text-xs text-gray-400">تاريخ الفاتورة</p>
                <p className="font-medium">{formatDateShort(bill.date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">تاريخ الاستحقاق</p>
                <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>{formatDateShort(bill.dueDate)}</p>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>#</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead className="text-left">الكمية</TableHead>
                  <TableHead className="text-left">سعر الوحدة</TableHead>
                  {hasVat && <TableHead className="text-left">الضريبة</TableHead>}
                  <TableHead className="text-left">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.items.map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-gray-400 text-sm">{i + 1}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-left">{Number(item.quantity).toFixed(2)}</TableCell>
                    <TableCell className="text-left">{fmt(Number(item.unitPrice))}</TableCell>
                    {hasVat && (
                      <TableCell className="text-left text-sm text-gray-500">
                        {item.taxRate ? `${Number(item.taxRate.rate)}% (${fmt(Number(item.taxAmount))})` : "-"}
                      </TableCell>
                    )}
                    <TableCell className="text-left font-medium">{fmt(Number(item.total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={hasVat ? 5 : 4} className="text-left font-medium">المجموع الفرعي</TableCell>
                  <TableCell className="text-left">{fmt(Number(bill.subtotal))}</TableCell>
                </TableRow>
                {hasVat && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-left font-medium text-orange-700">
                      {country.vatName}
                    </TableCell>
                    <TableCell className="text-left text-orange-700">{fmt(Number(bill.taxAmount))}</TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-purple-50">
                  <TableCell colSpan={hasVat ? 5 : 4} className="text-left font-bold text-lg">
                    الإجمالي النهائي
                  </TableCell>
                  <TableCell className="text-left font-bold text-lg text-purple-700">
                    {fmt(Number(bill.total))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {Number(bill.amountDue) > 0 && (
            <div className={`rounded-lg p-4 ${isOverdue ? "bg-red-50 border border-red-200" : "bg-orange-50 border border-orange-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-bold ${isOverdue ? "text-red-700" : "text-orange-700"}`}>
                    {isOverdue ? "⚠️ فاتورة متأخرة!" : "💰 مبلغ مستحق للمورد"}
                  </p>
                  <p className="text-sm text-gray-600">
                    تم دفع: {fmt(Number(bill.amountPaid))} | متبقي: {fmt(Number(bill.amountDue))}
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/payments/new?billId=${bill.id}`}>تسجيل دفعة</Link>
                </Button>
              </div>
            </div>
          )}

          {bill.notes && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">ملاحظات:</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{bill.notes}</p>
            </div>
          )}

          <div className="border-t pt-4">
            <AttachmentPanel entityId={params.id} entityType="BILL" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

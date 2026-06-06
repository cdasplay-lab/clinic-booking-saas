import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { ArrowRight, Printer, Send } from "lucide-react"
import Link from "next/link"

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: "مسودة",            color: "bg-gray-100 text-gray-700" },
  SENT:      { label: "مرسلة",            color: "bg-blue-100 text-blue-700" },
  PARTIAL:   { label: "مدفوع جزئياً",     color: "bg-yellow-100 text-yellow-700" },
  PAID:      { label: "مدفوعة بالكامل",  color: "bg-green-100 text-green-700" },
  OVERDUE:   { label: "متأخرة",           color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "ملغاة",            color: "bg-gray-100 text-gray-500" },
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { contact: true, items: { include: { taxRate: true } } },
  })
  if (!invoice) notFound()

  const org = userOrg.organization
  const country = getCountry(org.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  const isOverdue = invoice.dueDate < new Date() && ["SENT", "PARTIAL"].includes(invoice.status)
  const displayStatus = isOverdue ? "OVERDUE" : invoice.status
  const status = statusConfig[displayStatus] || statusConfig.DRAFT

  // Invoice title depends on whether the country has VAT
  const invoiceTitle = country.vatEnabled ? "فاتورة ضريبية" : "فاتورة"
  const hasVat = country.vatEnabled && Number(invoice.taxAmount) > 0

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/invoices"><ArrowRight className="h-4 w-4" /> الفواتير</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/print/invoices/${params.id}`} target="_blank" rel="noopener noreferrer">
              <Printer className="h-4 w-4" /> طباعة / PDF
            </a>
          </Button>
          {invoice.status === "DRAFT" && (
            <Button size="sm">
              <Send className="h-4 w-4" /> إرسال للعميل
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{org.name}</h1>
              {org.address && <p className="text-blue-200 text-sm mt-1">{org.address}</p>}
              {org.phone && <p className="text-blue-200 text-sm">{org.phone}</p>}
              {org.taxNumber && (
                <p className="text-blue-200 text-sm">
                  {country.zatcaRequired ? "الرقم الضريبي (ZATCA): " : country.ftaRequired ? "رقم TRN: " : "الرقم الضريبي: "}
                  {org.taxNumber}
                </p>
              )}
            </div>
            <div className="text-left">
              <p className="text-3xl font-bold">{invoiceTitle}</p>
              <p className="text-blue-200 text-lg font-mono">{invoice.number}</p>
              <p className="text-blue-100 text-sm mt-1">
                {country.flag} {country.nameAr} · {country.currencySymbol}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Status + Dates */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">فاتورة إلى:</p>
              <p className="font-bold text-lg">{invoice.contact.name}</p>
              {invoice.contact.taxNumber && <p className="text-sm text-gray-500">رقم ضريبي: {invoice.contact.taxNumber}</p>}
              {invoice.contact.address && <p className="text-sm text-gray-500">{invoice.contact.address}</p>}
              {invoice.contact.phone && <p className="text-sm text-gray-500">{invoice.contact.phone}</p>}
            </div>
            <div className="text-left space-y-2">
              <div>
                <p className="text-xs text-gray-400">تاريخ الفاتورة</p>
                <p className="font-medium">{formatDateShort(invoice.date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">تاريخ الاستحقاق</p>
                <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>{formatDateShort(invoice.dueDate)}</p>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>

          {/* Items Table */}
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
                {invoice.items.map((item, i) => (
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
                  <TableCell className="text-left">{fmt(Number(invoice.subtotal))}</TableCell>
                </TableRow>
                {hasVat && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-left font-medium text-orange-700">
                      {country.vatName}
                    </TableCell>
                    <TableCell className="text-left text-orange-700">{fmt(Number(invoice.taxAmount))}</TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-blue-50">
                  <TableCell colSpan={hasVat ? 5 : 4} className="text-left font-bold text-lg">
                    الإجمالي النهائي
                  </TableCell>
                  <TableCell className="text-left font-bold text-lg text-blue-700">
                    {fmt(Number(invoice.total))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Payment Status Banner */}
          {Number(invoice.amountDue) > 0 && (
            <div className={`rounded-lg p-4 ${isOverdue ? "bg-red-50 border border-red-200" : "bg-orange-50 border border-orange-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-bold ${isOverdue ? "text-red-700" : "text-orange-700"}`}>
                    {isOverdue ? "⚠️ فاتورة متأخرة!" : "💰 مبلغ مستحق"}
                  </p>
                  <p className="text-sm text-gray-600">
                    تم دفع: {fmt(Number(invoice.amountPaid))} | متبقي: {fmt(Number(invoice.amountDue))}
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/payments/new?invoiceId=${invoice.id}`}>تسجيل دفعة</Link>
                </Button>
              </div>
            </div>
          )}

          {invoice.notes && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">ملاحظات:</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

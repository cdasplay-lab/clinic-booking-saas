import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, Printer, FileX2 } from "lucide-react"
import Link from "next/link"

export default async function CreditNoteDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const note = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId, type: "CREDIT_NOTE" },
    include: {
      contact:         true,
      items:           { include: { taxRate: true } },
      creditedInvoice: { select: { id: true, number: true } },
    },
  })
  if (!note) notFound()

  const org = userOrg.organization
  const country = getCountry(org.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/credit-notes"><ArrowRight className="h-4 w-4" /> إشعارات الخصم</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/print/credit-notes/${params.id}`} target="_blank" rel="noopener noreferrer">
            <Printer className="h-4 w-4 ml-1" />طباعة / PDF
          </a>
        </Button>
      </div>

      <Card className="overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{org.name}</h1>
              {org.address && <p className="text-orange-100 text-sm mt-1">{org.address}</p>}
              {org.phone  && <p className="text-orange-100 text-sm">{org.phone}</p>}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2 justify-end mb-1">
                <FileX2 className="h-5 w-5 text-orange-200" />
                <p className="text-2xl font-bold">إشعار خصم</p>
              </div>
              <p className="text-orange-200 text-lg font-mono">{note.number}</p>
              {note.creditedInvoice && (
                <p className="text-orange-100 text-sm mt-1">
                  بخصوص الفاتورة: {note.creditedInvoice.number}
                </p>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-1">صادر إلى</p>
              <p className="font-semibold">{note.contact.name}</p>
              {note.contact.email && <p className="text-gray-500">{note.contact.email}</p>}
              {note.contact.phone && <p className="text-gray-500">{note.contact.phone}</p>}
            </div>
            <div className="text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">تاريخ الإشعار</span>
                <span>{formatDateShort(note.date)}</span>
              </div>
              {note.reason && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">السبب</span>
                  <span className="text-left">{note.reason}</span>
                </div>
              )}
              {note.creditedInvoice && (
                <div className="flex justify-between">
                  <span className="text-gray-500">الفاتورة الأصلية</span>
                  <Link href={`/dashboard/invoices/${note.creditedInvoice.id}`} className="text-blue-600 hover:underline font-mono">
                    {note.creditedInvoice.number}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>الوصف</TableHead>
                <TableHead className="text-center">الكمية</TableHead>
                <TableHead className="text-left">السعر</TableHead>
                {Number(note.taxAmount) > 0 && <TableHead className="text-left">الضريبة</TableHead>}
                <TableHead className="text-left">الإجمالي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {note.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-center">{Number(item.quantity)}</TableCell>
                  <TableCell className="text-left font-mono">{fmt(Number(item.unitPrice))}</TableCell>
                  {Number(note.taxAmount) > 0 && (
                    <TableCell className="text-left text-sm text-gray-500">
                      {item.taxRate ? `${Number(item.taxRate.rate)}%` : "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-left font-medium">{fmt(Number(item.total))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">المجموع الفرعي</span>
                <span>{fmt(Number(note.subtotal))}</span>
              </div>
              {Number(note.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">الضريبة</span>
                  <span>{fmt(Number(note.taxAmount))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2 text-orange-600">
                <span>إجمالي الإشعار</span>
                <span>({fmt(Number(note.total))})</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

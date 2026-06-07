import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, Printer, FilePlus2 } from "lucide-react"
import Link from "next/link"

export default async function DebitNoteDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const note = await prisma.bill.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId, type: "DEBIT_NOTE" },
    include: {
      contact:      true,
      items:        { include: { taxRate: true } },
      creditedBill: { select: { id: true, number: true } },
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
          <Link href="/dashboard/debit-notes"><ArrowRight className="h-4 w-4" /> إشعارات الإضافة</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/print/debit-notes/${params.id}`} target="_blank" rel="noopener noreferrer">
            <Printer className="h-4 w-4 ml-1" />طباعة / PDF
          </a>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{org.name}</h1>
              {org.address && <p className="text-purple-200 text-sm mt-1">{org.address}</p>}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2 justify-end mb-1">
                <FilePlus2 className="h-5 w-5 text-purple-200" />
                <p className="text-2xl font-bold">إشعار إضافة</p>
              </div>
              <p className="text-purple-200 text-lg font-mono">{note.number}</p>
              {note.creditedBill && (
                <p className="text-purple-100 text-sm mt-1">بخصوص الفاتورة: {note.creditedBill.number}</p>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-1">المورد</p>
              <p className="font-semibold">{note.contact.name}</p>
              {note.contact.email && <p className="text-gray-500">{note.contact.email}</p>}
            </div>
            <div className="text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">تاريخ الإشعار</span>
                <span>{formatDateShort(note.date)}</span>
              </div>
              {note.reason && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">السبب</span>
                  <span>{note.reason}</span>
                </div>
              )}
              {note.creditedBill && (
                <div className="flex justify-between">
                  <span className="text-gray-500">الفاتورة الأصلية</span>
                  <Link href={`/dashboard/bills/${note.creditedBill.id}`} className="text-blue-600 hover:underline font-mono">
                    {note.creditedBill.number}
                  </Link>
                </div>
              )}
            </div>
          </div>

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

          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">المجموع الفرعي</span><span>{fmt(Number(note.subtotal))}</span></div>
              {Number(note.taxAmount) > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">الضريبة</span><span>{fmt(Number(note.taxAmount))}</span></div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2 text-purple-600">
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

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileX2, Plus } from "lucide-react"
import Link from "next/link"

export default async function CreditNotesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const notes = await prisma.invoice.findMany({
    where: { organizationId: userOrg.organizationId, type: "CREDIT_NOTE" },
    include: { contact: true, creditedInvoice: { select: { number: true } } },
    orderBy: { date: "desc" },
  })

  const country = getCountry(userOrg.organization.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إشعارات الخصم</h1>
          <p className="text-sm text-gray-500">عكس أو تخفيض فواتير المبيعات</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/invoices">
            <Plus className="h-4 w-4 ml-1" />إصدار إشعار جديد
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileX2 className="h-5 w-5 text-orange-500" />
            إشعارات الخصم ({notes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileX2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">لا توجد إشعارات خصم</p>
              <p className="text-sm mt-1">انتقل إلى فاتورة واضغط "إصدار إشعار خصم"</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الإشعار</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>الفاتورة المرتبطة</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead className="text-left">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((note) => (
                  <TableRow key={note.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell>
                      <Link href={`/dashboard/credit-notes/${note.id}`} className="font-mono text-blue-600 hover:underline">
                        {note.number}
                      </Link>
                    </TableCell>
                    <TableCell>{note.contact.name}</TableCell>
                    <TableCell>
                      {note.creditedInvoice ? (
                        <Link href={`/dashboard/invoices/${note.creditedInvoiceId}`} className="text-blue-600 hover:underline font-mono text-sm">
                          {note.creditedInvoice.number}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">{note.reason || "—"}</TableCell>
                    <TableCell className="text-sm">{formatDateShort(note.date)}</TableCell>
                    <TableCell className="text-left font-medium text-orange-600">
                      ({fmt(Number(note.total))})
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

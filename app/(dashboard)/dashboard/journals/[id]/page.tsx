import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import AttachmentPanel from "@/components/attachments/attachment-panel"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

const typeLabels: Record<string, string> = {
  GENERAL: "قيد عام",
  PAYMENT: "دفعة",
  RECEIPT: "استلام",
  SALES: "مبيعات",
  PURCHASE: "مشتريات",
  CONTRA: "قيد مقاصة",
  CREDIT_NOTE: "إشعار دائن",
  DEBIT_NOTE: "إشعار مدين",
  OPENING: "أرصدة افتتاحية",
  PAYROLL: "رواتب",
}

export default async function JournalDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const journal = await prisma.journal.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { lines: { include: { account: true }, orderBy: { sortOrder: "asc" } } },
  })
  if (!journal) notFound()

  const org = userOrg.organization
  const country = getCountry(org.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  const statusVariant = journal.status === "POSTED" ? "success" : journal.status === "CANCELLED" ? "destructive" : "secondary"
  const statusLabel = journal.status === "POSTED" ? "مرحّل" : journal.status === "CANCELLED" ? "ملغي" : "مسودة"

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/journals"><ArrowRight className="h-4 w-4" /> القيود اليومية</Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-gray-700 to-gray-800 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{org.name}</h1>
              <p className="text-gray-300 text-sm mt-1">{formatDateShort(journal.date)}</p>
            </div>
            <div className="text-left">
              <p className="text-3xl font-bold">{typeLabels[journal.type] || journal.type}</p>
              <p className="text-gray-300 text-lg font-mono">{journal.number}</p>
              {journal.reference && <p className="text-gray-400 text-sm">مرجع: {journal.reference}</p>}
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">الوصف</p>
              <p className="font-medium text-lg">{journal.description}</p>
            </div>
            <div className="text-left space-y-2">
              <Badge variant={statusVariant as any}>{statusLabel}</Badge>
              {journal.isReconciled && (
                <Badge variant="outline" className="block text-center">تمت المطابقة</Badge>
              )}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>الحساب</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead className="text-left">مدين</TableHead>
                  <TableHead className="text-left">دائن</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{line.account.nameAr || line.account.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{line.account.code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{line.description || "-"}</TableCell>
                    <TableCell className="text-left font-medium">
                      {Number(line.debit) > 0 ? fmt(Number(line.debit)) : "-"}
                    </TableCell>
                    <TableCell className="text-left font-medium">
                      {Number(line.credit) > 0 ? fmt(Number(line.credit)) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-gray-50">
                  <TableCell colSpan={2} className="text-left font-bold">الإجمالي</TableCell>
                  <TableCell className="text-left font-bold text-blue-700">{fmt(Number(journal.totalDebit))}</TableCell>
                  <TableCell className="text-left font-bold text-blue-700">{fmt(Number(journal.totalCredit))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {Number(journal.totalDebit) !== Number(journal.totalCredit) && (
            <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              ⚠️ القيد غير متوازن — المدين والدائن غير متساويين
            </div>
          )}

          <div className="border-t pt-4">
            <AttachmentPanel entityId={params.id} entityType="JOURNAL" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

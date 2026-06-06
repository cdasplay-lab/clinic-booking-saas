import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import ExportButton from "@/components/reports/export-button"

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

export default async function JournalsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const journals = await prisma.journal.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { lines: { include: { account: true } } },
    orderBy: { date: "desc" },
    take: 100,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">القيود اليومية</h1>
          <p className="text-sm text-gray-500">{journals.length} قيد</p>
        </div>
        <div className="flex gap-2">
          <ExportButton type="journals" label="Excel" />
          <Button asChild>
            <Link href="/dashboard/journals/new">
              <Plus className="h-4 w-4" />
              قيد جديد
            </Link>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الوصف</TableHead>
              <TableHead className="text-left">المدين</TableHead>
              <TableHead className="text-left">الدائن</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {journals.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-mono text-sm">{j.number}</TableCell>
                <TableCell>{formatDateShort(j.date)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{typeLabels[j.type] || j.type}</Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">{j.description}</TableCell>
                <TableCell className="text-left">{formatCurrency(Number(j.totalDebit))}</TableCell>
                <TableCell className="text-left">{formatCurrency(Number(j.totalCredit))}</TableCell>
                <TableCell>
                  <Badge variant={j.status === "POSTED" ? "success" : j.status === "CANCELLED" ? "destructive" : "secondary"}>
                    {j.status === "POSTED" ? "مرحّل" : j.status === "CANCELLED" ? "ملغي" : "مسودة"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

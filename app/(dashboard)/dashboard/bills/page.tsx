import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, FileText } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import ExportButton from "@/components/reports/export-button"
import { EmptyState } from "@/components/ui/empty-state"

export default async function BillsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const bills = await prisma.bill.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: true },
    orderBy: { date: "desc" },
  })

  const statusLabels: Record<string, { label: string; variant: any }> = {
    DRAFT: { label: "مسودة", variant: "secondary" },
    OPEN: { label: "مفتوحة", variant: "default" },
    PARTIAL: { label: "مدفوع جزئياً", variant: "warning" },
    PAID: { label: "مدفوعة", variant: "success" },
    OVERDUE: { label: "متأخرة", variant: "destructive" },
    CANCELLED: { label: "ملغاة", variant: "outline" },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">فواتير الموردين</h1>
          <p className="text-sm text-gray-500">{bills.length} فاتورة</p>
        </div>
        <div className="flex gap-2">
          <ExportButton type="bills" label="Excel" />
          <Button asChild>
            <Link href="/dashboard/bills/new">
              <Plus className="h-4 w-4" />
              فاتورة مورد جديدة
            </Link>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>تاريخ الاستحقاق</TableHead>
              <TableHead className="text-left">الإجمالي</TableHead>
              <TableHead className="text-left">المتبقي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={FileText}
                    title="لا توجد فواتير موردين بعد"
                    description="سجّل فواتير الموردين والمشتريات لتتبع ذممك الدائنة ومصروفاتك"
                    href="/dashboard/bills/new"
                    ctaLabel="فاتورة مورد جديدة"
                    secondaryHref="/dashboard/contacts/vendors/new"
                    secondaryLabel="أضف مورداً أولاً"
                  />
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => {
                const status = statusLabels[bill.status] || { label: bill.status, variant: "outline" }
                const isOverdue = bill.dueDate < new Date() && ["OPEN", "PARTIAL"].includes(bill.status)

                return (
                  <TableRow key={bill.id}>
                    <TableCell className="font-mono font-medium">{bill.number}</TableCell>
                    <TableCell>{bill.contact.name}</TableCell>
                    <TableCell>{formatDateShort(bill.date)}</TableCell>
                    <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>{formatDateShort(bill.dueDate)}</TableCell>
                    <TableCell className="text-left">{formatCurrency(Number(bill.total))}</TableCell>
                    <TableCell className={`text-left font-medium ${Number(bill.amountDue) > 0 ? "text-red-600" : "text-gray-500"}`}>
                      {formatCurrency(Number(bill.amountDue))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isOverdue ? "destructive" : status.variant}>{isOverdue ? "متأخرة" : status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/bills/${bill.id}`}>عرض</Link>
                      </Button>
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

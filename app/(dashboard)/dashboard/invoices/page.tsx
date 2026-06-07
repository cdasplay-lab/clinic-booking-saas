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

const statusLabels: Record<string, { label: string; variant: any }> = {
  DRAFT: { label: "مسودة", variant: "secondary" },
  SENT: { label: "مرسلة", variant: "default" },
  PARTIAL: { label: "مدفوع جزئياً", variant: "warning" },
  PAID: { label: "مدفوعة", variant: "success" },
  OVERDUE: { label: "متأخرة", variant: "destructive" },
  CANCELLED: { label: "ملغاة", variant: "outline" },
}

export default async function InvoicesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: userOrg.organizationId, type: "INVOICE" },
    include: { contact: true },
    orderBy: { date: "desc" },
  })

  const totals = {
    draft: invoices.filter((i) => i.status === "DRAFT").reduce((s, i) => s + Number(i.total), 0),
    outstanding: invoices.filter((i) => ["SENT", "PARTIAL", "OVERDUE"].includes(i.status)).reduce((s, i) => s + Number(i.amountDue), 0),
    paid: invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total), 0),
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-sm text-gray-500">{invoices.length} فاتورة</p>
        </div>
        <div className="flex gap-2">
          <ExportButton type="invoices" label="Excel" />
          <Button asChild>
            <Link href="/dashboard/invoices/new">
              <Plus className="h-4 w-4" />
              فاتورة جديدة
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">مسودات</p>
          <p className="text-xl font-bold">{formatCurrency(totals.draft)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">مستحق</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(totals.outstanding)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">مدفوع</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totals.paid)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>تاريخ الاستحقاق</TableHead>
              <TableHead className="text-left">الإجمالي</TableHead>
              <TableHead className="text-left">المتبقي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={FileText}
                    title="لا توجد فواتير بعد"
                    description="أنشئ أول فاتورة لعميلك وابدأ في تتبع مدفوعاتك بشكل احترافي"
                    href="/dashboard/invoices/new"
                    ctaLabel="فاتورة جديدة"
                    secondaryHref="/dashboard/contacts/customers/new"
                    secondaryLabel="أضف عميلاً أولاً"
                  />
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const status = statusLabels[inv.status] || { label: inv.status, variant: "outline" }
                const isOverdue = inv.dueDate < new Date() && ["SENT", "PARTIAL"].includes(inv.status)

                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-medium">{inv.number}</TableCell>
                    <TableCell>{inv.contact.name}</TableCell>
                    <TableCell>{formatDateShort(inv.date)}</TableCell>
                    <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                      {formatDateShort(inv.dueDate)}
                    </TableCell>
                    <TableCell className="text-left">{formatCurrency(Number(inv.total))}</TableCell>
                    <TableCell className={`text-left font-medium ${Number(inv.amountDue) > 0 ? "text-orange-600" : "text-gray-500"}`}>
                      {formatCurrency(Number(inv.amountDue))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isOverdue ? "destructive" : status.variant}>{isOverdue ? "متأخرة" : status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/invoices/${inv.id}`}>عرض</Link>
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

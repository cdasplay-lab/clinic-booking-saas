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
import { SearchBar } from "@/components/ui/search-bar"
import { StatusFilter } from "@/components/ui/status-filter"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { Suspense } from "react"

const PAGE_SIZE = 25

const statusLabels: Record<string, { label: string; variant: any }> = {
  DRAFT:     { label: "مسودة",         variant: "secondary" },
  OPEN:      { label: "مفتوحة",        variant: "default" },
  PARTIAL:   { label: "مدفوع جزئياً", variant: "warning" },
  PAID:      { label: "مدفوعة",        variant: "success" },
  OVERDUE:   { label: "متأخرة",        variant: "destructive" },
  CANCELLED: { label: "ملغاة",         variant: "outline" },
}

const STATUS_OPTIONS = [
  { value: "DRAFT",     label: "مسودة" },
  { value: "OPEN",      label: "مفتوحة" },
  { value: "PARTIAL",   label: "جزئي" },
  { value: "OVERDUE",   label: "متأخرة" },
  { value: "PAID",      label: "مدفوعة" },
  { value: "CANCELLED", label: "ملغاة" },
]

export default async function BillsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; status?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const q      = searchParams.q?.trim() || ""
  const status = searchParams.status || ""
  const page   = Math.max(1, Number(searchParams.page) || 1)

  const where = {
    organizationId: userOrg.organizationId,
    ...(status ? { status: status as any } : {}),
    ...(q ? {
      OR: [
        { number: { contains: q, mode: "insensitive" as const } },
        { contact: { name: { contains: q, mode: "insensitive" as const } } },
        { notes: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  }

  const [total, bills] = await Promise.all([
    prisma.bill.count({ where }),
    prisma.bill.findMany({
      where,
      include: { contact: { select: { name: true } } },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  const spForPagination: Record<string, string> = {}
  if (q) spForPagination.q = q
  if (status) spForPagination.status = status

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">فواتير الموردين</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString("ar-SA")} فاتورة</p>
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

      <div className="flex flex-col md:flex-row gap-3">
        <Suspense>
          <SearchBar placeholder="بحث برقم الفاتورة أو اسم المورد..." className="w-full md:w-72" />
        </Suspense>
        <Suspense>
          <StatusFilter options={STATUS_OPTIONS} />
        </Suspense>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الاستحقاق</TableHead>
              <TableHead className="text-left">الإجمالي</TableHead>
              <TableHead className="text-left">المتبقي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  {total === 0 && !q && !status ? (
                    <EmptyState
                      icon={FileText}
                      title="لا توجد فواتير موردين بعد"
                      description="سجّل فواتير الموردين والمشتريات لتتبع ذممك الدائنة"
                      href="/dashboard/bills/new"
                      ctaLabel="فاتورة مورد جديدة"
                    />
                  ) : (
                    <div className="text-center py-10 text-gray-400">لا توجد نتائج</div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => {
                const cfg = statusLabels[bill.status] || { label: bill.status, variant: "outline" }
                const isOverdue = bill.dueDate < new Date() && ["OPEN", "PARTIAL"].includes(bill.status)
                return (
                  <TableRow key={bill.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono font-medium text-sm">{bill.number}</TableCell>
                    <TableCell className="font-medium">{bill.contact.name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{formatDateShort(bill.date)}</TableCell>
                    <TableCell className={`text-sm ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                      {formatDateShort(bill.dueDate)}
                    </TableCell>
                    <TableCell className="text-left">{formatCurrency(Number(bill.total))}</TableCell>
                    <TableCell className={`text-left font-medium ${Number(bill.amountDue) > 0 ? "text-red-600" : "text-gray-400"}`}>
                      {formatCurrency(Number(bill.amountDue))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isOverdue ? "destructive" : cfg.variant}>
                        {isOverdue ? "متأخرة" : cfg.label}
                      </Badge>
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

        {total > PAGE_SIZE && (
          <div className="border-t px-4">
            <PaginationBar page={page} total={total} pageSize={PAGE_SIZE} baseUrl="/dashboard/bills" searchParams={spForPagination} />
          </div>
        )}
      </div>
    </div>
  )
}

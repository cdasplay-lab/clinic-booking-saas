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
  DRAFT:     { label: "مسودة",          variant: "secondary" },
  SENT:      { label: "مرسلة",          variant: "default" },
  PARTIAL:   { label: "مدفوع جزئياً",   variant: "warning" },
  PAID:      { label: "مدفوعة",         variant: "success" },
  OVERDUE:   { label: "متأخرة",         variant: "destructive" },
  CANCELLED: { label: "ملغاة",          variant: "outline" },
}

const STATUS_OPTIONS = [
  { value: "DRAFT",     label: "مسودة" },
  { value: "SENT",      label: "مرسلة" },
  { value: "PARTIAL",   label: "جزئي" },
  { value: "OVERDUE",   label: "متأخرة" },
  { value: "PAID",      label: "مدفوعة" },
  { value: "CANCELLED", label: "ملغاة" },
]

export default async function InvoicesPage({
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
    type: "INVOICE" as const,
    ...(status ? { status: status as any } : {}),
    ...(q ? {
      OR: [
        { number: { contains: q, mode: "insensitive" as const } },
        { contact: { name: { contains: q, mode: "insensitive" as const } } },
        { notes: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  }

  const [total, invoices, summaryRaw] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { contact: { select: { name: true } } },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Summary always over ALL invoices (no search filter)
    prisma.invoice.groupBy({
      by: ["status"],
      where: { organizationId: userOrg.organizationId, type: "INVOICE" },
      _sum: { total: true, amountDue: true },
    }),
  ])

  const getSum = (s: string, field: "total" | "amountDue") =>
    Number(summaryRaw.find((r) => r.status === s)?._sum?.[field] || 0)

  const totals = {
    draft:       getSum("DRAFT",   "total"),
    outstanding: ["SENT", "PARTIAL", "OVERDUE"].reduce((s, st) => s + getSum(st, "amountDue"), 0),
    paid:        getSum("PAID",    "total"),
  }

  const spForPagination: Record<string, string> = {}
  if (q) spForPagination.q = q
  if (status) spForPagination.status = status

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString("ar-SA")} فاتورة</p>
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

      {/* Summary */}
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

      {/* Search + Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <Suspense>
          <SearchBar placeholder="بحث برقم الفاتورة أو اسم العميل..." className="w-full md:w-72" />
        </Suspense>
        <Suspense>
          <StatusFilter options={STATUS_OPTIONS} />
        </Suspense>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الاستحقاق</TableHead>
              <TableHead className="text-left">الإجمالي</TableHead>
              <TableHead className="text-left">المتبقي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  {total === 0 && !q && !status ? (
                    <EmptyState
                      icon={FileText}
                      title="لا توجد فواتير بعد"
                      description="أنشئ أول فاتورة لعميلك وابدأ في تتبع مدفوعاتك"
                      href="/dashboard/invoices/new"
                      ctaLabel="فاتورة جديدة"
                    />
                  ) : (
                    <div className="text-center py-10 text-gray-400">
                      لا توجد نتائج للبحث الحالي
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const isOverdue = inv.dueDate < new Date() && ["SENT", "PARTIAL"].includes(inv.status)
                const cfg = statusLabels[inv.status] || { label: inv.status, variant: "outline" }
                return (
                  <TableRow key={inv.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono font-medium text-sm">{inv.number}</TableCell>
                    <TableCell className="font-medium">{inv.contact.name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{formatDateShort(inv.date)}</TableCell>
                    <TableCell className={`text-sm ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                      {formatDateShort(inv.dueDate)}
                    </TableCell>
                    <TableCell className="text-left">{formatCurrency(Number(inv.total))}</TableCell>
                    <TableCell className={`text-left font-medium ${Number(inv.amountDue) > 0 ? "text-orange-600" : "text-gray-400"}`}>
                      {formatCurrency(Number(inv.amountDue))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isOverdue ? "destructive" : cfg.variant}>
                        {isOverdue ? "متأخرة" : cfg.label}
                      </Badge>
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

        {total > PAGE_SIZE && (
          <div className="border-t px-4">
            <PaginationBar
              page={page}
              total={total}
              pageSize={PAGE_SIZE}
              baseUrl="/dashboard/invoices"
              searchParams={spForPagination}
            />
          </div>
        )}
      </div>
    </div>
  )
}

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, FileStack } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"
import ExportButton from "@/components/reports/export-button"
import { SearchBar } from "@/components/ui/search-bar"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { Suspense } from "react"

const PAGE_SIZE = 30

const typeLabels: Record<string, string> = {
  GENERAL: "قيد عام", PAYMENT: "دفعة", RECEIPT: "استلام",
  SALES: "مبيعات", PURCHASE: "مشتريات", CONTRA: "مقاصة",
  CREDIT_NOTE: "إشعار دائن", DEBIT_NOTE: "إشعار مدين",
  OPENING: "أرصدة افتتاحية", PAYROLL: "رواتب",
}

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const q    = searchParams.q?.trim() || ""
  const page = Math.max(1, Number(searchParams.page) || 1)

  const where = {
    organizationId: userOrg.organizationId,
    ...(q ? {
      OR: [
        { number: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
        { reference: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  }

  const [total, journals] = await Promise.all([
    prisma.journal.count({ where }),
    prisma.journal.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  const spForPagination: Record<string, string> = {}
  if (q) spForPagination.q = q

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">القيود اليومية</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString("ar-SA")} قيد</p>
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

      <Suspense>
        <SearchBar placeholder="بحث برقم القيد أو الوصف أو المرجع..." className="w-full md:w-72" />
      </Suspense>

      <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الوصف</TableHead>
              <TableHead className="text-left">مدين</TableHead>
              <TableHead className="text-left">دائن</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {journals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  {total === 0 && !q ? (
                    <EmptyState
                      icon={FileStack}
                      title="لا توجد قيود يومية بعد"
                      description="القيود تُنشأ تلقائياً مع كل فاتورة ودفعة، أو يمكنك إنشاء قيد يدوي"
                      href="/dashboard/journals/new"
                      ctaLabel="قيد يدوي جديد"
                    />
                  ) : (
                    <div className="text-center py-10 text-gray-400">لا توجد نتائج</div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              journals.map((j) => (
                <TableRow key={j.id} className="hover:bg-gray-50">
                  <TableCell className="font-mono text-sm font-medium">{j.number}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{formatDateShort(j.date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{typeLabels[j.type] || j.type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{j.description}</TableCell>
                  <TableCell className="text-left">{formatCurrency(Number(j.totalDebit))}</TableCell>
                  <TableCell className="text-left">{formatCurrency(Number(j.totalCredit))}</TableCell>
                  <TableCell>
                    <Badge variant={j.status === "POSTED" ? "success" : j.status === "CANCELLED" ? "destructive" : "secondary"}>
                      {j.status === "POSTED" ? "مرحّل" : j.status === "CANCELLED" ? "ملغي" : "مسودة"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/journals/${j.id}`}>عرض</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {total > PAGE_SIZE && (
          <div className="border-t px-4">
            <PaginationBar page={page} total={total} pageSize={PAGE_SIZE} baseUrl="/dashboard/journals" searchParams={spForPagination} />
          </div>
        )}
      </div>
    </div>
  )
}

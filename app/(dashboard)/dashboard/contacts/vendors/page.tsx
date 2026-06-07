import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Users } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { SearchBar } from "@/components/ui/search-bar"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { EmptyState } from "@/components/ui/empty-state"
import { Suspense } from "react"

const PAGE_SIZE = 40

export default async function VendorsPage({
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
    type: { in: ["VENDOR", "BOTH"] as const },
    isActive: true,
    ...(q ? {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { taxNumber: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  }

  const [total, vendors] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      include: {
        bills: {
          where: { status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
          select: { amountDue: true },
        },
      },
      orderBy: { name: "asc" },
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
          <h1 className="text-2xl font-bold">الموردون</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString("ar-SA")} مورد</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/contacts/vendors/new">
            <Plus className="h-4 w-4" /> مورد جديد
          </Link>
        </Button>
      </div>

      <Suspense>
        <SearchBar placeholder="بحث بالاسم أو الهاتف أو البريد..." className="w-full md:w-72" />
      </Suspense>

      <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الهاتف</TableHead>
              <TableHead>البريد</TableHead>
              <TableHead>الرقم الضريبي</TableHead>
              <TableHead className="text-left">المستحق</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  {total === 0 && !q ? (
                    <EmptyState
                      icon={Users}
                      title="لا يوجد موردون بعد"
                      description="أضف موردين لتتبع فواتيرهم ومدفوعاتك لهم"
                      href="/dashboard/contacts/vendors/new"
                      ctaLabel="إضافة مورد"
                    />
                  ) : (
                    <div className="text-center py-10 text-gray-400">لا توجد نتائج</div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              vendors.map((v) => {
                const outstanding = v.bills.reduce((s, b) => s + Number(b.amountDue), 0)
                return (
                  <TableRow key={v.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{v.phone || "—"}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{v.email || "—"}</TableCell>
                    <TableCell className="text-gray-500 text-sm font-mono">{v.taxNumber || "—"}</TableCell>
                    <TableCell className={`text-left font-medium ${outstanding > 0 ? "text-red-600" : "text-gray-400"}`}>
                      {formatCurrency(outstanding)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/contacts/${v.id}`}>كشف</Link>
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
            <PaginationBar page={page} total={total} pageSize={PAGE_SIZE} baseUrl="/dashboard/contacts/vendors" searchParams={spForPagination} />
          </div>
        )}
      </div>
    </div>
  )
}

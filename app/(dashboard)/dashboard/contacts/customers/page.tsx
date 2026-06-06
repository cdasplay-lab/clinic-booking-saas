import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Users } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function CustomersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const customers = await prisma.contact.findMany({
    where: {
      organizationId: userOrg.organizationId,
      type: { in: ["CUSTOMER", "BOTH"] },
      isActive: true,
    },
    include: {
      invoices: {
        where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
        select: { amountDue: true },
      },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العملاء</h1>
          <p className="text-sm text-gray-500">{customers.length} عميل</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/contacts/customers/new">
            <Plus className="h-4 w-4" />
            عميل جديد
          </Link>
        </Button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الهاتف</TableHead>
              <TableHead>البريد الإلكتروني</TableHead>
              <TableHead>الرقم الضريبي</TableHead>
              <TableHead className="text-left">المستحق</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  لا يوجد عملاء بعد
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => {
                const outstanding = c.invoices.reduce((s, i) => s + Number(i.amountDue), 0)
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone || "-"}</TableCell>
                    <TableCell>{c.email || "-"}</TableCell>
                    <TableCell>{c.taxNumber || "-"}</TableCell>
                    <TableCell className={`text-left font-medium ${outstanding > 0 ? "text-orange-600" : "text-gray-500"}`}>
                      {formatCurrency(outstanding)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/contacts/${c.id}`}>عرض</Link>
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

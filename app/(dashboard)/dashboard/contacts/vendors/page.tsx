import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Users } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function VendorsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) redirect("/onboarding")

  const vendors = await prisma.contact.findMany({
    where: { organizationId: userOrg.organizationId, type: { in: ["VENDOR", "BOTH"] }, isActive: true },
    include: { bills: { where: { status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } }, select: { amountDue: true } } },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">الموردون</h1><p className="text-sm text-gray-500">{vendors.length} مورد</p></div>
        <Button asChild><Link href="/dashboard/contacts/vendors/new"><Plus className="h-4 w-4" /> مورد جديد</Link></Button>
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead>الاسم</TableHead><TableHead>الهاتف</TableHead><TableHead>البريد</TableHead><TableHead>الرقم الضريبي</TableHead><TableHead className="text-left">المستحق</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {vendors.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500"><Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />لا يوجد موردون بعد</TableCell></TableRow>
            ) : vendors.map((v) => {
              const outstanding = v.bills.reduce((s, b) => s + Number(b.amountDue), 0)
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.phone || "-"}</TableCell>
                  <TableCell>{v.email || "-"}</TableCell>
                  <TableCell>{v.taxNumber || "-"}</TableCell>
                  <TableCell className={`text-left font-medium ${outstanding > 0 ? "text-red-600" : "text-gray-500"}`}>{formatCurrency(outstanding)}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" asChild><Link href={`/dashboard/contacts/${v.id}`}>عرض</Link></Button></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

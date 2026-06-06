import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDateShort } from "@/lib/utils"

export default async function DayBookPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const journals = await prisma.journal.findMany({
    where: { organizationId: userOrg.organizationId, status: "POSTED" },
    include: {
      lines: {
        include: { account: true },
        orderBy: { debit: "desc" },
      },
    },
    orderBy: { date: "desc" },
    take: 50,
  })

  const typeLabels: Record<string, string> = {
    GENERAL: "قيد عام",
    PAYMENT: "دفعة",
    RECEIPT: "استلام",
    SALES: "مبيعات",
    PURCHASE: "مشتريات",
    CONTRA: "مقاصة",
    CREDIT_NOTE: "إشعار دائن",
    DEBIT_NOTE: "إشعار مدين",
    PAYROLL: "رواتب",
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">دفتر اليومية</h1>
        <p className="text-sm text-gray-500">
          {userOrg.organization.name} · آخر 50 قيد مرحّل
        </p>
      </div>

      <div className="space-y-4">
        {journals.map((j) => (
          <div key={j.id} className="bg-white rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-medium text-blue-600">{j.number}</span>
                <Badge variant="outline" className="text-xs">{typeLabels[j.type] || j.type}</Badge>
                <span className="text-sm text-gray-600">{j.description}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>{formatDateShort(j.date)}</span>
                <span className="font-medium text-gray-700">{formatCurrency(Number(j.totalDebit))}</span>
              </div>
            </div>
            <Table>
              <TableBody>
                {j.lines.map((line) => (
                  <TableRow key={line.id} className="text-sm">
                    <TableCell className="w-8 text-gray-400">{line.debit > 0 ? "" : "···"}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{line.account.code}</TableCell>
                    <TableCell className={line.debit > 0 ? "font-medium" : "text-gray-600 pr-8"}>
                      {line.account.name}
                    </TableCell>
                    <TableCell className="text-left font-medium">
                      {Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : ""}
                    </TableCell>
                    <TableCell className="text-left text-gray-500">
                      {Number(line.credit) > 0 ? formatCurrency(Number(line.credit)) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}

        {journals.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg border">
            لا توجد قيود بعد
          </div>
        )}
      </div>
    </div>
  )
}

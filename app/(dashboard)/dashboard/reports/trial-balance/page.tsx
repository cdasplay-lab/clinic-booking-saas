import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getTrialBalance } from "@/lib/accounting"
import { formatCurrency } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import ExportButton from "@/components/reports/export-button"

export default async function TrialBalancePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const asOfDate = new Date()
  const accounts = await getTrialBalance(userOrg.organizationId, asOfDate)

  const totalDebit = accounts.reduce((s, a) => s + (a.nature === "DEBIT" && a.balance > 0 ? a.balance : 0), 0)
  const totalCredit = accounts.reduce((s, a) => s + (a.nature === "CREDIT" && a.balance > 0 ? a.balance : 0), 0)

  const country = getCountry(userOrg.organization.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">ميزان المراجعة</h1>
          <p className="text-sm text-gray-500">
            {userOrg.organization.name} · حتى {asOfDate.toLocaleDateString("ar-SA")}
          </p>
        </div>
        <ExportButton type="trial-balance" />
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>كود الحساب</TableHead>
              <TableHead>اسم الحساب</TableHead>
              <TableHead>المجموعة</TableHead>
              <TableHead className="text-left">مدين</TableHead>
              <TableHead className="text-left">دائن</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.accountId}>
                <TableCell className="font-mono text-sm">{a.accountCode}</TableCell>
                <TableCell>{a.accountName}</TableCell>
                <TableCell className="text-gray-500 text-sm">{a.groupName}</TableCell>
                <TableCell className="text-left">
                  {a.nature === "DEBIT" && a.balance > 0 ? fmt(a.balance) : "-"}
                </TableCell>
                <TableCell className="text-left">
                  {a.nature === "CREDIT" && a.balance > 0 ? fmt(a.balance) : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-500">إجمالي المدين</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalDebit)}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-500">إجمالي الدائن</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalCredit)}</p>
        </div>
      </div>

      <div className={`p-4 rounded-lg text-center font-bold ${
        Math.abs(totalDebit - totalCredit) < 1 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}>
        {Math.abs(totalDebit - totalCredit) < 1 ? "✓ ميزان المراجعة متوازن" : `⚠ فرق: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
      </div>
    </div>
  )
}

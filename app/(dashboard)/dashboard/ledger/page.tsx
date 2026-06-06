import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default async function LedgerPage({ searchParams }: { searchParams: { accountId?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const orgId = userOrg.organizationId

  const accounts = await prisma.account.findMany({
    where: { organizationId: orgId, isActive: true },
    orderBy: { code: "asc" },
  })

  const selectedAccountId = searchParams.accountId || accounts[0]?.id

  let lines: any[] = []
  let selectedAccount: any = null

  if (selectedAccountId) {
    selectedAccount = accounts.find((a) => a.id === selectedAccountId)
    lines = await prisma.journalLine.findMany({
      where: { accountId: selectedAccountId, journal: { status: "POSTED" } },
      include: { journal: true },
      orderBy: { journal: { date: "asc" } },
    })
  }

  let runningBalance = selectedAccount ? Number(selectedAccount.openingBalance) : 0
  const linesWithBalance = lines.map((line) => {
    const debit = Number(line.debit)
    const credit = Number(line.credit)
    if (selectedAccount?.nature === "DEBIT") {
      runningBalance += debit - credit
    } else {
      runningBalance += credit - debit
    }
    return { ...line, runningBalance }
  })

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">كشف الحساب</h1>
          <p className="text-sm text-gray-500">{userOrg.organization.name}</p>
        </div>
        <div className="w-72">
          <form>
            <Select name="accountId" defaultValue={selectedAccountId}>
              <SelectTrigger><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </form>
        </div>
      </div>

      {selectedAccount && (
        <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-blue-800">{selectedAccount.code} - {selectedAccount.name}</p>
            <p className="text-sm text-blue-600">رصيد افتتاحي: {formatCurrency(Number(selectedAccount.openingBalance))}</p>
          </div>
          <div className="text-left">
            <p className="text-sm text-gray-500">الرصيد الحالي</p>
            <p className="text-2xl font-bold text-blue-800">{formatCurrency(runningBalance)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>رقم القيد</TableHead>
              <TableHead>الوصف</TableHead>
              <TableHead className="text-left">مدين</TableHead>
              <TableHead className="text-left">دائن</TableHead>
              <TableHead className="text-left">الرصيد</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linesWithBalance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  لا توجد حركات لهذا الحساب
                </TableCell>
              </TableRow>
            ) : (
              linesWithBalance.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{formatDateShort(line.journal.date)}</TableCell>
                  <TableCell className="font-mono text-sm text-blue-600">{line.journal.number}</TableCell>
                  <TableCell className="text-sm">{line.description || line.journal.description}</TableCell>
                  <TableCell className="text-left">{Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : "-"}</TableCell>
                  <TableCell className="text-left">{Number(line.credit) > 0 ? formatCurrency(Number(line.credit)) : "-"}</TableCell>
                  <TableCell className={`text-left font-medium ${line.runningBalance < 0 ? "text-red-600" : ""}`}>
                    {formatCurrency(Math.abs(line.runningBalance))} {line.runningBalance < 0 ? "دائن" : "مدين"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {linesWithBalance.length > 0 && (
            <TableFooter>
              <TableRow className="bg-gray-50 font-bold">
                <TableCell colSpan={3}>الإجمالي</TableCell>
                <TableCell className="text-left">{formatCurrency(totalDebit)}</TableCell>
                <TableCell className="text-left">{formatCurrency(totalCredit)}</TableCell>
                <TableCell className="text-left">{formatCurrency(Math.abs(runningBalance))}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

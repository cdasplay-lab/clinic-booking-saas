import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, BookOpen } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function AccountsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const accounts = await prisma.account.findMany({
    where: { organizationId: userOrg.organizationId, isActive: true },
    include: {
      group: true,
      journalLines: {
        where: { journal: { status: "POSTED" } },
      },
    },
    orderBy: { code: "asc" },
  })

  const accountsWithBalance = accounts.map((acc) => {
    const debit = acc.journalLines.reduce((s, l) => s + Number(l.debit), 0)
    const credit = acc.journalLines.reduce((s, l) => s + Number(l.credit), 0)
    const opening = Number(acc.openingBalance)
    const balance = acc.nature === "DEBIT" ? opening + debit - credit : opening + credit - debit
    return { ...acc, balance }
  })

  const typeLabels: Record<string, string> = {
    ASSET: "أصول",
    LIABILITY: "خصوم",
    EQUITY: "حقوق ملكية",
    REVENUE: "إيرادات",
    EXPENSE: "مصروفات",
    BANK: "بنك",
    CASH: "صندوق",
    ACCOUNTS_RECEIVABLE: "ذمم مدينة",
    ACCOUNTS_PAYABLE: "ذمم دائنة",
    STOCK: "مخزون",
    FIXED_ASSET: "أصول ثابتة",
    TAX: "ضرائب",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">دليل الحسابات</h1>
          <p className="text-sm text-gray-500">{accounts.length} حساب</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/accounts/new">
            <Plus className="h-4 w-4" />
            إضافة حساب
          </Link>
        </Button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>اسم الحساب</TableHead>
              <TableHead>المجموعة</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead className="text-left">الرصيد</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accountsWithBalance.map((acc) => (
              <TableRow key={acc.id}>
                <TableCell className="font-mono text-sm">{acc.code}</TableCell>
                <TableCell className="font-medium">{acc.name}</TableCell>
                <TableCell className="text-gray-500 text-sm">{acc.group.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{typeLabels[acc.accountType] || acc.accountType}</Badge>
                </TableCell>
                <TableCell className={`text-left font-medium ${acc.balance >= 0 ? "text-gray-900" : "text-red-600"}`}>
                  {formatCurrency(acc.balance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

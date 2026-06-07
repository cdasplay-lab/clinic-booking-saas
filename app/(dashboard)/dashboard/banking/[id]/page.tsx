import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, Upload, TrendingUp, TrendingDown, Building2 } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const statusLabels: Record<string, { label: string; color: string }> = {
  UNRECONCILED: { label: "غير مسوى",   color: "bg-yellow-100 text-yellow-700" },
  RECONCILED:   { label: "مسوى",       color: "bg-green-100 text-green-700" },
  EXCLUDED:     { label: "مستبعد",     color: "bg-gray-100 text-gray-500" },
}

export default async function BankAccountPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: {
      account: true,
      transactions: {
        orderBy: { date: "desc" },
        take: 100,
      },
    },
  })
  if (!bankAccount) notFound()

  const totalIn  = bankAccount.transactions.reduce((s, t) => s + Number(t.credit), 0)
  const totalOut = bankAccount.transactions.reduce((s, t) => s + Number(t.debit),  0)

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/banking"><ArrowRight className="h-4 w-4 ml-1" /> الحسابات البنكية</Link>
        </Button>
        <Button asChild>
          <Link href={`/dashboard/banking/${params.id}/import`}>
            <Upload className="h-4 w-4 ml-1" />
            استيراد كشف البنك
          </Link>
        </Button>
      </div>

      {/* Account summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{bankAccount.name}</h1>
              <p className="text-sm text-gray-500">{bankAccount.bankName || "بنك"}</p>
              {bankAccount.iban && <p className="text-xs font-mono text-gray-400 mt-1">{bankAccount.iban}</p>}
              {bankAccount.accountNumber && (
                <p className="text-xs font-mono text-gray-400">رقم الحساب: {bankAccount.accountNumber}</p>
              )}
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-400">الرصيد الحالي</p>
              <p className={`text-2xl font-bold mt-1 ${Number(bankAccount.currentBalance) >= 0 ? "text-gray-800" : "text-red-600"}`}>
                {formatCurrency(Number(bankAccount.currentBalance))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
            <div>
              <p className="text-xs text-gray-500">إجمالي الإيداعات</p>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(totalIn)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">إجمالي السحوبات</p>
              <p className="text-lg font-semibold text-red-600">{formatCurrency(totalOut)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">عدد الحركات</p>
              <p className="text-lg font-semibold">{bankAccount.transactions.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">حركات الحساب</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-xs">
                <TableHead>التاريخ</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>المرجع</TableHead>
                <TableHead className="text-left">إيداع</TableHead>
                <TableHead className="text-left">سحب</TableHead>
                <TableHead className="text-left">الرصيد</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankAccount.transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-gray-400">
                    لا توجد حركات. ابدأ باستيراد كشف البنك.
                  </TableCell>
                </TableRow>
              ) : (
                bankAccount.transactions.map((t) => {
                  const st = statusLabels[t.status] || statusLabels.UNRECONCILED
                  return (
                    <TableRow key={t.id} className="text-sm">
                      <TableCell className="whitespace-nowrap">{formatDateShort(t.date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={t.description}>{t.description}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">{t.reference || "—"}</TableCell>
                      <TableCell className="text-left font-mono text-green-700 text-sm">
                        {Number(t.credit) > 0 ? (
                          <span className="flex items-center gap-1 justify-end">
                            <TrendingUp className="h-3 w-3" />
                            {formatCurrency(Number(t.credit))}
                          </span>
                        ) : ""}
                      </TableCell>
                      <TableCell className="text-left font-mono text-red-600 text-sm">
                        {Number(t.debit) > 0 ? (
                          <span className="flex items-center gap-1 justify-end">
                            <TrendingDown className="h-3 w-3" />
                            {formatCurrency(Number(t.debit))}
                          </span>
                        ) : ""}
                      </TableCell>
                      <TableCell className="text-left font-mono text-sm font-medium">
                        {formatCurrency(Number(t.balance))}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${st.color} border-0`}>{st.label}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

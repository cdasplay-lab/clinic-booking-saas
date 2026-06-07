import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Building2, TrendingUp, TrendingDown } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"

export default async function BankingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId: userOrg.organizationId },
    include: {
      account: true,
      transactions: {
        orderBy: { date: "desc" },
        take: 5,
      },
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الحسابات البنكية</h1>
          <p className="text-sm text-gray-500">{bankAccounts.length} حساب</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/banking/new">
            <Plus className="h-4 w-4" />
            إضافة حساب بنكي
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bankAccounts.length === 0 ? (
          <div className="col-span-3">
            <EmptyState
              icon={Building2}
              title="لا توجد حسابات بنكية بعد"
              description="أضف حساباتك البنكية وصناديقك النقدية لتتبع أرصدتك وتسوية كشوفاتك البنكية"
              href="/dashboard/banking/new"
              ctaLabel="إضافة حساب بنكي"
            />
          </div>
        ) : (
          bankAccounts.map((ba) => (
            <Card key={ba.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{ba.name}</CardTitle>
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-sm text-gray-500">{ba.bankName || "بنك"}</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(Number(ba.currentBalance))}</p>
                {ba.accountNumber && (
                  <p className="text-xs text-gray-400 font-mono mt-1">**** **** {ba.accountNumber.slice(-4)}</p>
                )}
                <div className="mt-3 space-y-1">
                  {ba.transactions.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 truncate max-w-[140px]">{t.description}</span>
                      <div className="flex items-center gap-1">
                        {Number(t.credit) > 0 ? (
                          <>
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-green-600">+{formatCurrency(Number(t.credit))}</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-3 w-3 text-red-500" />
                            <span className="text-red-600">-{formatCurrency(Number(t.debit))}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3" asChild>
                  <Link href={`/dashboard/banking/${ba.id}`}>عرض التفاصيل</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

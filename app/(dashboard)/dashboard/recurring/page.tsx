import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatDateShort } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import RecurringActions from "@/components/recurring/recurring-actions"

const freqLabels: Record<string, string> = {
  WEEKLY: "أسبوعياً",
  MONTHLY: "شهرياً",
  QUARTERLY: "ربع سنوي",
  YEARLY: "سنوياً",
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE:  { label: "نشط",    color: "bg-green-100 text-green-700" },
  PAUSED:  { label: "موقوف",  color: "bg-yellow-100 text-yellow-700" },
  ENDED:   { label: "منتهي",  color: "bg-gray-100 text-gray-500" },
}

export default async function RecurringPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const country = getCountry(userOrg.organization.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  const recurring = await prisma.recurringInvoice.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: true, items: { include: { taxRate: true } } },
    orderBy: [{ status: "asc" }, { nextDate: "asc" }],
  })

  function calcTotal(items: any[]): number {
    return items.reduce((sum, item) => {
      const sub = Number(item.quantity) * Number(item.unitPrice)
      const taxRate = item.taxRate ? Number(item.taxRate.rate) / 100 : 0
      return sum + sub + sub * taxRate
    }, 0)
  }

  const active = recurring.filter((r) => r.status === "ACTIVE").length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            الفواتير المتكررة
          </h1>
          <p className="text-sm text-gray-500">{active} نشط · {recurring.length} إجمالي</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/recurring/new">
            <Plus className="h-4 w-4" />
            فاتورة متكررة جديدة
          </Link>
        </Button>
      </div>

      {recurring.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <RefreshCw className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">لا توجد فواتير متكررة</p>
            <p className="text-sm mt-1">أنشئ فاتورة متكررة لإصدارها تلقائياً كل شهر أو ربع سنة</p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/recurring/new">
                <Plus className="h-4 w-4" /> إنشاء أول فاتورة متكررة
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {recurring.map((rec) => {
            const status = statusConfig[rec.status]
            const total = calcTotal(rec.items)
            const isOverdue = rec.status === "ACTIVE" && rec.nextDate < new Date()

            return (
              <Card key={rec.id} className={`overflow-hidden ${isOverdue ? "border-orange-300" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold">{rec.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {freqLabels[rec.frequency]}
                        </Badge>
                        {isOverdue && (
                          <span className="text-xs text-orange-600 font-medium">⚠️ موعد الإصدار تجاوز اليوم</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{rec.contact.name}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span>التالي: <strong className={isOverdue ? "text-orange-600" : ""}>{formatDateShort(rec.nextDate)}</strong></span>
                        {rec.endDate && <span>ينتهي: {formatDateShort(rec.endDate)}</span>}
                        <span>صدر {rec.totalGenerated} مرة</span>
                        <span>استحقاق: {rec.dueDays} يوم</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {rec.items.length} بند · {rec.items.slice(0, 2).map((i) => i.description).join("، ")}
                        {rec.items.length > 2 && "..."}
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0 space-y-2">
                      <p className="font-bold text-lg text-blue-700">{fmt(total)}</p>
                      <p className="text-xs text-gray-400">{freqLabels[rec.frequency]}</p>
                      <RecurringActions recurringId={rec.id} status={rec.status} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

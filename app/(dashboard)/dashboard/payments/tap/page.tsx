import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getTapCharge } from "@/lib/tap"
import { getCountry } from "@/lib/countries"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"

export default async function TapResultPage({
  searchParams,
}: {
  searchParams: { invoiceId?: string; chargeId?: string; tap_id?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const invoiceId = searchParams.invoiceId
  const chargeId = searchParams.tap_id || searchParams.chargeId

  if (!invoiceId || !chargeId || chargeId === "CHARGE_ID") {
    redirect("/dashboard/invoices")
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: userOrg.organizationId },
    include: { contact: true },
  })
  if (!invoice) redirect("/dashboard/invoices")

  const country = getCountry(userOrg.organization.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  // Fetch charge from Tap to get real status
  let chargeStatus = "UNKNOWN"
  let chargeAmount = 0
  try {
    if (process.env.TAP_SECRET_KEY) {
      const charge = await getTapCharge(chargeId)
      chargeStatus = charge.status
      chargeAmount = charge.amount
    }
  } catch { /* show pending if API fails */ }

  const isCaptured = chargeStatus === "CAPTURED"
  const isFailed = ["CANCELLED", "FAILED", "DECLINED", "RESTRICTED"].includes(chargeStatus)

  return (
    <div className="max-w-lg mx-auto mt-12 space-y-4">
      <Card className="overflow-hidden">
        <div className={`p-6 text-white text-center ${isCaptured ? "bg-green-600" : isFailed ? "bg-red-600" : "bg-yellow-500"}`}>
          {isCaptured ? (
            <CheckCircle className="h-16 w-16 mx-auto mb-3" />
          ) : isFailed ? (
            <XCircle className="h-16 w-16 mx-auto mb-3" />
          ) : (
            <Clock className="h-16 w-16 mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold">
            {isCaptured ? "تم الدفع بنجاح!" : isFailed ? "فشلت عملية الدفع" : "الدفع قيد المعالجة"}
          </h1>
          {chargeAmount > 0 && isCaptured && (
            <p className="text-lg mt-1 opacity-90">{fmt(chargeAmount)}</p>
          )}
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">الفاتورة</span>
              <span className="font-mono font-medium">{invoice.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">العميل</span>
              <span className="font-medium">{invoice.contact.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">رقم المعاملة</span>
              <span className="font-mono text-xs text-gray-600">{chargeId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">الحالة</span>
              <span className={`font-medium ${isCaptured ? "text-green-600" : isFailed ? "text-red-600" : "text-yellow-600"}`}>
                {isCaptured ? "مكتملة" : isFailed ? "مرفوضة" : "معلّقة"}
              </span>
            </div>
          </div>

          {isCaptured && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              تم تسجيل الدفعة وتحديث رصيد الفاتورة تلقائياً.
            </div>
          )}

          {isFailed && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى من صفحة الفاتورة.
            </div>
          )}

          {!isCaptured && !isFailed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
              الدفعة قيد المعالجة. سيتم تحديث الفاتورة تلقائياً عند اكتمالها.
            </div>
          )}

          <Button className="w-full" asChild>
            <Link href={`/dashboard/invoices/${invoice.id}`}>
              <ArrowRight className="h-4 w-4" />
              العودة للفاتورة
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

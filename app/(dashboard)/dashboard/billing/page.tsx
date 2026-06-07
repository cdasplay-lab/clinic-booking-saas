import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Zap, AlertCircle } from "lucide-react"
import { CheckoutButton } from "@/components/billing/checkout-button"
import { PortalButton } from "@/components/billing/portal-button"

const plans = [
  {
    id: "FREE",
    name: "مجاني",
    price: 0,
    period: "",
    color: "border-gray-200",
    features: ["شركة واحدة", "مستخدم واحد", "100 فاتورة شهرياً", "التقارير الأساسية", "دعم عبر البريد"],
  },
  {
    id: "STARTER",
    name: "أساسي",
    price: 99,
    period: "ريال/شهر",
    color: "border-blue-200",
    features: ["3 شركات", "5 مستخدمين", "فواتير غير محدودة", "جميع التقارير", "دعم أولوي"],
  },
  {
    id: "PROFESSIONAL",
    name: "احترافي",
    price: 299,
    period: "ريال/شهر",
    recommended: true,
    color: "border-blue-500",
    features: ["10 شركات", "20 مستخدم", "فواتير غير محدودة", "AI Agent محاسبي", "API Access", "تقارير متقدمة", "دعم 24/7"],
  },
  {
    id: "ENTERPRISE",
    name: "مؤسسي",
    price: 999,
    period: "ريال/شهر",
    color: "border-purple-500",
    features: ["غير محدود", "غير محدود", "غير محدود", "AI Agent متقدم", "API + Webhooks", "تكامل مخصص", "SLA 99.9%", "مدير حساب مخصص"],
  },
]

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string; cancelled?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const org         = userOrg.organization
  const currentPlan = org.plan
  const hasStripe   = !!org.stripeCustomerId
  const expiresAt   = org.planExpiresAt
  const isOwnerAdmin = ["OWNER", "ADMIN"].includes(userOrg.role)

  return (
    <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">الاشتراك والفوترة</h1>
        <p className="text-sm text-gray-500">إدارة خطة اشتراكك</p>
      </div>

      {/* Success / cancel banners */}
      {searchParams.success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">تم تفعيل اشتراكك بنجاح! 🎉</span>
        </div>
      )}
      {searchParams.cancelled && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">تم إلغاء عملية الدفع. يمكنك المحاولة مجدداً في أي وقت.</span>
        </div>
      )}

      {/* Current subscription card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-gray-500">خطتك الحالية</p>
              <p className="text-xl font-bold">{plans.find((p) => p.id === currentPlan)?.name ?? "مجاني"}</p>
              {expiresAt && (
                <p className="text-xs text-gray-400 mt-0.5">
                  تجدد في {new Date(expiresAt).toLocaleDateString("ar-SA")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-green-100 text-green-700">نشط</Badge>
              {hasStripe && isOwnerAdmin && <PortalButton />}
              {currentPlan === "FREE" && (
                <div className="flex items-center gap-1 text-blue-600 text-sm font-medium">
                  <Zap className="h-4 w-4" />
                  ترقية للوصول إلى جميع الميزات
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans grid */}
      <div id="upgrade">
        <h2 className="text-lg font-bold mb-4">اختر خطتك</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent  = currentPlan === plan.id
            const isDowngrade = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]
              .indexOf(plan.id) < ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]
              .indexOf(currentPlan)

            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 p-5 relative ${plan.color} ${
                  plan.recommended ? "shadow-lg" : ""
                } ${isCurrent ? "bg-blue-50" : "bg-white"}`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 right-1/2 translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
                    الأكثر شيوعاً
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    حالياً
                  </div>
                )}

                <p className="font-bold text-base mb-1">{plan.name}</p>
                <div className="mb-4">
                  <span className="text-3xl font-bold">{plan.price === 0 ? "مجاني" : plan.price}</span>
                  {plan.price > 0 && <span className="text-gray-500 text-sm"> {plan.period}</span>}
                </div>

                <ul className="space-y-2 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    className="w-full rounded-md border border-gray-200 bg-gray-50 text-gray-500 text-sm py-2 cursor-default"
                    disabled
                  >
                    خطتك الحالية
                  </button>
                ) : plan.id === "FREE" ? (
                  <button
                    className="w-full rounded-md border border-gray-200 text-gray-500 text-sm py-2 cursor-not-allowed"
                    disabled
                  >
                    {isDowngrade ? "تخفيض عبر بوابة الاشتراك" : "الخطة المجانية"}
                  </button>
                ) : (
                  <CheckoutButton
                    planId={plan.id}
                    label={isDowngrade ? "تخفيض الخطة" : "اشترك الآن"}
                    variant={plan.recommended ? "default" : "outline"}
                    className="w-full"
                    disabled={!isOwnerAdmin}
                  />
                )}
              </div>
            )
          })}
        </div>
        {!isOwnerAdmin && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            يجب أن تكون مالكاً أو مديراً لتغيير خطة الاشتراك
          </p>
        )}
      </div>
    </div>
  )
}

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Zap } from "lucide-react"
import Link from "next/link"

const plans = [
  {
    id: "FREE",
    name: "مجاني",
    price: 0,
    period: "دائماً",
    color: "border-gray-200",
    features: [
      "شركة واحدة",
      "مستخدم واحد",
      "100 فاتورة شهرياً",
      "التقارير الأساسية",
      "دعم عبر البريد",
    ],
  },
  {
    id: "STARTER",
    name: "أساسي",
    price: 99,
    period: "ريال/شهر",
    color: "border-blue-200",
    features: [
      "3 شركات",
      "5 مستخدمين",
      "غير محدود",
      "جميع التقارير",
      "دعم أولوي",
    ],
  },
  {
    id: "PROFESSIONAL",
    name: "احترافي",
    price: 299,
    period: "ريال/شهر",
    recommended: true,
    color: "border-blue-500",
    features: [
      "10 شركات",
      "20 مستخدم",
      "غير محدود",
      "AI Agent محاسبي",
      "API Access",
      "تقارير متقدمة",
      "دعم أولوي 24/7",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "مؤسسي",
    price: 999,
    period: "ريال/شهر",
    color: "border-purple-500",
    features: [
      "غير محدود",
      "غير محدود",
      "غير محدود",
      "AI Agent متقدم",
      "API + Webhooks",
      "تكامل مخصص",
      "SLA 99.9%",
      "مدير حساب مخصص",
    ],
  },
]

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const currentPlan = userOrg.organization.plan

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">الاشتراك والفوترة</h1>
        <p className="text-sm text-gray-500">إدارة خطة اشتراكك</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">خطتك الحالية</p>
              <p className="text-xl font-bold">{plans.find((p) => p.id === currentPlan)?.name || "مجاني"}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-green-100 text-green-700">نشط</Badge>
              {currentPlan === "FREE" && (
                <Button asChild>
                  <Link href="#upgrade">ترقية الآن <Zap className="h-4 w-4 mr-1" /></Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div id="upgrade">
        <h2 className="text-lg font-bold mb-4">اختر خطتك</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border-2 p-5 relative ${plan.color} ${plan.recommended ? "shadow-lg" : ""} ${currentPlan === plan.id ? "bg-blue-50" : "bg-white"}`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 right-1/2 translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
                  الأكثر شيوعاً
                </div>
              )}
              {currentPlan === plan.id && (
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
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.recommended ? "default" : currentPlan === plan.id ? "secondary" : "outline"}
                disabled={currentPlan === plan.id}
              >
                {currentPlan === plan.id ? "خطتك الحالية" : plan.price === 0 ? "تخفيض" : "اختر هذه الخطة"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

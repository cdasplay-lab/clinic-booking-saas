import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, Users, Shield, CheckCircle2, Sparkles, Bell, Hash } from "lucide-react"
import { getCountry } from "@/lib/countries"
import OrgSettingsForm from "@/components/settings/org-settings-form"
import DemoSeedButton from "@/components/settings/demo-seed-button"
import TwoFactorSettings from "@/components/settings/two-factor-settings"
import ReminderSettings from "@/components/settings/reminder-settings"
import Link from "next/link"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const org = userOrg.organization
  const isOwnerOrAdmin = ["OWNER", "ADMIN"].includes(userOrg.role)

  const [usersCount, currentUser] = await Promise.all([
    prisma.userOrganization.count({ where: { organizationId: org.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { twoFactorEnabled: true } }),
  ])

  const country = getCountry(org.country)

  const planLabels: Record<string, string> = {
    FREE: "مجاني", STARTER: "أساسي", PROFESSIONAL: "احترافي", ENTERPRISE: "مؤسسي",
  }

  // Pricing in org currency
  const plans = [
    {
      name: "أساسي",
      price: country.code === "IQ" ? "50,000 د.ع/شهر" : country.code === "AE" ? "99 د.إ/شهر" : "99 ر.س/شهر",
      features: ["5 مستخدمين", "تقارير أساسية", "فواتير ومشتريات", "دعم عبر البريد"],
    },
    {
      name: "احترافي",
      price: country.code === "IQ" ? "150,000 د.ع/شهر" : country.code === "AE" ? "249 د.إ/شهر" : "249 ر.س/شهر",
      features: ["20 مستخدم", "AI Agent كامل", "واتساب", "دعم أولوي"],
      recommended: true,
    },
    {
      name: "مؤسسي",
      price: country.code === "IQ" ? "500,000 د.ع/شهر" : country.code === "AE" ? "799 د.إ/شهر" : "799 ر.س/شهر",
      features: ["غير محدود", "API مفتوح", "خادم مخصص", "دعم 24/7"],
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-sm text-gray-500">إدارة إعدادات شركتك والحساب</p>
      </div>

      {/* Company Info Form */}
      {isOwnerOrAdmin ? (
        <OrgSettingsForm org={{
          id: org.id,
          name: org.name,
          email: org.email,
          phone: org.phone,
          address: org.address,
          city: org.city,
          country: org.country,
          taxNumber: org.taxNumber,
          logo: org.logo,
          fiscalYearStart: org.fiscalYearStart,
          plan: org.plan,
          baseCurrency: org.baseCurrency,
        }} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
              <Shield className="h-4 w-4" />
              <p className="text-sm">لا تملك صلاحية تعديل إعدادات الشركة. تواصل مع المالك.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-600" />
            <CardTitle>خطة الاشتراك</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">الخطة الحالية</p>
              <p className="font-bold text-lg">HesabPro {planLabels[org.plan] || org.plan}</p>
            </div>
            <Badge className="text-sm px-3 py-1" variant={org.plan === "FREE" ? "secondary" : "default"}>
              {planLabels[org.plan] || org.plan}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`border rounded-xl p-4 transition-all ${plan.recommended ? "border-blue-500 bg-blue-50 shadow-sm" : "hover:border-gray-300"}`}
              >
                {plan.recommended && (
                  <div className="text-xs font-bold text-blue-600 mb-2">⭐ الأكثر شيوعاً</div>
                )}
                <p className="font-bold text-base">{plan.name}</p>
                <p className="text-blue-600 font-bold text-sm my-2">{plan.price}</p>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant={plan.recommended ? "default" : "outline"}
                  className="w-full"
                  disabled
                >
                  {org.plan === "FREE" && plan.name === "أساسي" ? "الخطة الحالية" : "الترقية قريباً"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Numbering */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-indigo-600" />
                <CardTitle>ترقيم المستندات</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">خصص بادئة وتنسيق الأرقام للفواتير وعروض الأسعار والمزيد</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/settings/numbering">تخصيص الأرقام</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <CardTitle>المستخدمون</CardTitle>
            </div>
            <Badge variant="outline">{usersCount} مستخدم</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">إدارة أعضاء الفريق وصلاحياتهم</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/settings/users">إدارة المستخدمين</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Demo Data */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <CardTitle>بيانات تجريبية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              تحميل عملاء وفواتير ومصروفات وموظفين تجريبيين لرؤية النظام بشكل كامل.
              <span className="text-red-500 font-medium"> تعمل فقط إذا الشركة فارغة.</span>
            </p>
            <DemoSeedButton />
          </CardContent>
        </Card>
      )}

      {/* Payment Reminders */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <CardTitle>تذكيرات الدفع التلقائية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ReminderSettings
              enabled={org.reminderEnabled}
              days={org.reminderDays}
            />
          </CardContent>
        </Card>
      )}

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-600" />
            <CardTitle>الأمان</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <div>
              <p className="font-medium text-sm">كلمة المرور</p>
              <p className="text-xs text-gray-500">غيّر كلمة مرورك بأمان</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/settings/profile">تغيير كلمة المرور</Link>
            </Button>
          </div>
          <TwoFactorSettings enabled={!!currentUser?.twoFactorEnabled} />
        </CardContent>
      </Card>
    </div>
  )
}

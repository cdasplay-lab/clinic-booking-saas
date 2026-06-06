import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Building2, CreditCard, Users, Shield } from "lucide-react"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const org = userOrg.organization
  const usersCount = await prisma.userOrganization.count({
    where: { organizationId: org.id },
  })

  const planLabels: Record<string, string> = {
    FREE: "مجاني",
    STARTER: "أساسي",
    PROFESSIONAL: "احترافي",
    ENTERPRISE: "مؤسسي",
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-sm text-gray-500">إدارة إعدادات شركتك والحساب</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle>معلومات الشركة</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم الشركة</Label>
              <Input defaultValue={org.name} />
            </div>
            <div className="space-y-2">
              <Label>الرقم الضريبي</Label>
              <Input defaultValue={org.taxNumber || ""} placeholder="300000000000003" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" defaultValue={org.email || ""} />
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input defaultValue={org.phone || ""} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>العنوان</Label>
              <Input defaultValue={org.address || ""} />
            </div>
          </div>
          <Button>حفظ التغييرات</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-600" />
            <CardTitle>خطة الاشتراك</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium">الخطة الحالية</p>
              <p className="text-sm text-gray-500">HesabPro {planLabels[org.plan]}</p>
            </div>
            <Badge className="text-base px-3 py-1">{planLabels[org.plan]}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { name: "أساسي", price: "99 ريال/شهر", features: ["5 مستخدمين", "تقارير أساسية", "دعم عبر البريد"] },
              { name: "احترافي", price: "299 ريال/شهر", features: ["20 مستخدم", "AI Agent", "دعم أولوي"], recommended: true },
              { name: "مؤسسي", price: "999 ريال/شهر", features: ["غير محدود", "API مفتوح", "دعم مخصص"] },
            ].map((plan) => (
              <div key={plan.name} className={`border rounded-lg p-4 ${plan.recommended ? "border-blue-500 bg-blue-50" : ""}`}>
                {plan.recommended && <Badge className="mb-2 text-xs">الأكثر شيوعاً</Badge>}
                <p className="font-bold">{plan.name}</p>
                <p className="text-blue-600 font-medium my-2">{plan.price}</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
                <Button size="sm" variant={plan.recommended ? "default" : "outline"} className="w-full mt-3">
                  اختر
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            <CardTitle>المستخدمون</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-gray-600">{usersCount} مستخدم في المنظمة</p>
            <Button variant="outline" size="sm">إضافة مستخدم</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, MessageCircle, ExternalLink, Loader2, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default function WhatsAppSetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    phoneNumberId: "",
    accessToken: "",
    webhookVerifyToken: "hesabpro-" + Math.random().toString(36).slice(2, 8),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    setLoading(true)
    setError("")
    const res = await fetch("/api/whatsapp/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error || "حدث خطأ")
      setLoading(false)
    } else {
      setStep(3)
      setLoading(false)
    }
  }

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/whatsapp`
    : "https://yourapp.com/api/webhooks/whatsapp"

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/whatsapp"><ArrowRight className="h-4 w-4" /> تكامل واتساب</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            ربط WhatsApp Business API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Steps indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= s ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
                }`}>{s}</div>
                {s < 3 && <div className={`h-0.5 w-12 ${step > s ? "bg-green-500" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">الخطوة 1: إنشاء تطبيق Meta</h3>
              <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium text-blue-800">اتبع هذه الخطوات:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>اذهب إلى <strong>developers.facebook.com</strong></li>
                  <li>أنشئ تطبيقاً جديداً من نوع <strong>Business</strong></li>
                  <li>أضف منتج <strong>WhatsApp</strong> للتطبيق</li>
                  <li>احصل على <strong>Phone Number ID</strong> و <strong>Access Token</strong></li>
                </ol>
              </div>
              <Button className="w-full" variant="outline" asChild>
                <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> فتح Meta Developers
                </a>
              </Button>
              <Button className="w-full" onClick={() => setStep(2)}>التالي</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">الخطوة 2: أدخل بيانات الاتصال</h3>

              {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

              <div className="space-y-2">
                <Label>Phone Number ID</Label>
                <Input
                  value={form.phoneNumberId}
                  onChange={(e) => setForm({...form, phoneNumberId: e.target.value})}
                  placeholder="1234567890123456"
                  dir="ltr"
                />
                <p className="text-xs text-gray-400">تجده في: WhatsApp → Getting Started → Phone Number ID</p>
              </div>

              <div className="space-y-2">
                <Label>Access Token</Label>
                <Input
                  value={form.accessToken}
                  onChange={(e) => setForm({...form, accessToken: e.target.value})}
                  placeholder="EAAx..."
                  type="password"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label>Webhook URL (انسخه إلى Meta)</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly dir="ltr" className="font-mono text-xs" />
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                    نسخ
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Verify Token (انسخه إلى Meta)</Label>
                <div className="flex gap-2">
                  <Input value={form.webhookVerifyToken} readOnly dir="ltr" className="font-mono text-sm" />
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(form.webhookVerifyToken)}>
                    نسخ
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">
                <p className="font-medium">في إعدادات Webhook في Meta:</p>
                <p>• الـ Callback URL: الرابط أعلاه</p>
                <p>• الـ Verify Token: الكود أعلاه</p>
                <p>• اشترك في: <strong>messages</strong></p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>السابق</Button>
                <Button className="flex-1" onClick={handleSave} disabled={loading || !form.phoneNumberId || !form.accessToken}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  حفظ الإعدادات
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-xl font-bold text-green-700">تم الربط بنجاح!</h3>
              <p className="text-gray-600">
                الآن أرسل أي رسالة مالية من مجموعة واتساب وسيتم تسجيلها تلقائياً بعد تأكيدك.
              </p>
              <div className="bg-green-50 rounded-lg p-4 text-sm text-green-800 text-right">
                <p className="font-bold mb-2">أمثلة على الرسائل:</p>
                <p>• "اشترينا بضاعة من علي 5000 ريال"</p>
                <p>• "باعنا لعميل نجمة الخليج 12000 ريال"</p>
                <p>• "دفعنا إيجار المستودع 3500 ريال"</p>
                <p>• "استلمنا دفعة من أبو خالد 8000 ريال"</p>
              </div>
              <Button asChild className="w-full">
                <Link href="/dashboard/whatsapp">عرض لوحة واتساب</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

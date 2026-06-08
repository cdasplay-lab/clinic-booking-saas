"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BookOpen, CheckCircle2, ArrowLeft, ArrowRight,
  Building2, Briefcase, Stethoscope, ShoppingBag,
  UtensilsCrossed, Wrench, Loader2,
} from "lucide-react"

const INDUSTRIES = [
  { id: "general",      label: "تجارة عامة",        icon: ShoppingBag,     desc: "استيراد، تصدير، بيع وشراء بضائع" },
  { id: "gaming",       label: "ألعاب وإلكترونيات", icon: Building2,       desc: "بلي ستيشن، أجهزة، بطاقات PSN، إكسسوارات" },
  { id: "services",     label: "خدمات",             icon: Briefcase,       desc: "استشارات، برمجة، تسويق، تعليم" },
  { id: "construction", label: "مقاولات وإنشاء",    icon: Wrench,          desc: "تشييد، صيانة، مشاريع البناء" },
  { id: "clinic",       label: "عيادة وصحة",        icon: Stethoscope,     desc: "عيادات، مستشفيات، صيدليات" },
  { id: "restaurant",   label: "مطاعم وضيافة",      icon: UtensilsCrossed, desc: "مطاعم، كافيهات، فنادق" },
  { id: "retail",       label: "تجزئة وجملة",       icon: ShoppingBag,     desc: "محلات، سوبرماركت، متاجر إلكترونية" },
]

const STEPS = ["مرحباً بك", "بيانات الشركة", "نوع النشاط", "انتهيت!"]

export default function OnboardingPage() {
  const router  = useRouter()
  const [step, setStep]           = useState(0)
  const [industry, setIndustry]   = useState("general")
  const [loading, setLoading]     = useState(false)
  const [form, setForm] = useState({ address: "", phone: "", taxNumber: "" })

  function next() { setStep((s) => Math.min(s + 1, 3)) }
  function prev() { setStep((s) => Math.max(s - 1, 0)) }

  async function finish() {
    setLoading(true)
    try {
      await fetch("/api/onboarding/complete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, industry }),
      })
      router.push("/dashboard")
    } catch {
      router.push("/dashboard")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <span className="text-3xl font-bold text-blue-600">HesabPro</span>
          </div>
          <p className="text-gray-500 text-sm">نظام المحاسبة الذكي</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center w-full">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < step ? "bg-green-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
                }`}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-xs mt-1 hidden sm:block ${i === step ? "text-blue-600 font-medium" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 transition-all ${i < step ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <BookOpen className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">مرحباً بك في HesabPro! 🎉</h2>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                  سنساعدك على إعداد شركتك في دقيقتين فقط. اتبع الخطوات البسيطة وابدأ المحاسبة فوراً.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { emoji: "📊", label: "دليل حسابات جاهز" },
                  { emoji: "🧾", label: "فواتير احترافية" },
                  { emoji: "📈", label: "تقارير فورية" },
                ].map(({ emoji, label }) => (
                  <div key={label} className="bg-blue-50 rounded-xl p-3">
                    <div className="text-2xl mb-1">{emoji}</div>
                    <p className="text-xs font-medium text-blue-700">{label}</p>
                  </div>
                ))}
              </div>
              <Button size="lg" className="w-full" onClick={next}>
                ابدأ الإعداد <ArrowLeft className="h-4 w-4 mr-2" />
              </Button>
            </div>
          )}

          {/* Step 1 — Company profile */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">بيانات شركتك</h2>
                <p className="text-gray-500 text-sm mt-1">ستظهر هذه البيانات على فواتيرك (يمكنك تعديلها لاحقاً)</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="address">العنوان</Label>
                  <Input
                    id="address"
                    placeholder="مثال: شارع الملك فهد، الرياض، المملكة العربية السعودية"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    placeholder="+966 5x xxx xxxx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label htmlFor="taxNumber">الرقم الضريبي / رقم السجل التجاري</Label>
                  <Input
                    id="taxNumber"
                    placeholder="اختياري — يظهر على الفواتير الضريبية"
                    value={form.taxNumber}
                    onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                    className="mt-1"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={prev}>
                  <ArrowRight className="h-4 w-4 ml-1" /> السابق
                </Button>
                <Button className="flex-1" onClick={next}>
                  التالي <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — Industry */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">ما نوع نشاطك التجاري؟</h2>
                <p className="text-gray-500 text-sm mt-1">سنضيف الحسابات المناسبة لنشاطك تلقائياً</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {INDUSTRIES.map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => setIndustry(id)}
                    className={`text-right p-4 rounded-xl border-2 transition-all ${
                      industry === id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-5 w-5 ${industry === id ? "text-blue-600" : "text-gray-400"}`} />
                      <span className={`font-semibold text-sm ${industry === id ? "text-blue-700" : "text-gray-700"}`}>
                        {label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={prev}>
                  <ArrowRight className="h-4 w-4 ml-1" /> السابق
                </Button>
                <Button className="flex-1" onClick={next}>
                  التالي <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">كل شيء جاهز! 🚀</h2>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                  تم إعداد شركتك بنجاح. دليل الحسابات جاهز وكل أدواتك في مكانها.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-right space-y-3">
                <p className="text-sm font-semibold text-gray-700">ابدأ من هنا:</p>
                {[
                  { emoji: "👤", text: "أضف أول عميل لك" },
                  { emoji: "🧾", text: "أنشئ أول فاتورة" },
                  { emoji: "🏦", text: "ربط حسابك البنكي" },
                  { emoji: "📦", text: "أضف منتجاتك أو خدماتك" },
                ].map(({ emoji, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <span className="text-lg">{emoji}</span>
                    <span className="text-sm text-gray-600">{text}</span>
                  </div>
                ))}
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={finish}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري التهيئة...</>
                ) : (
                  <>انطلق إلى لوحة التحكم <ArrowLeft className="h-4 w-4 mr-2" /></>
                )}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          يمكنك تخطي أي خطوة وتكملتها لاحقاً من الإعدادات
        </p>
      </div>
    </div>
  )
}

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BookOpen, BarChart3, Bot, Shield, Zap, Globe, CheckCircle2, ArrowLeft } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen" dir="rtl">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-blue-600">HesabPro</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="#features" className="hover:text-blue-600">المزايا</Link>
            <Link href="#pricing" className="hover:text-blue-600">الأسعار</Link>
            <Link href="#about" className="hover:text-blue-600">عن المنتج</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link href="/login">تسجيل الدخول</Link></Button>
            <Button asChild><Link href="/register">ابدأ مجاناً</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-700/50 rounded-full px-4 py-2 text-sm mb-6">
            <Bot className="h-4 w-4" />
            مدعوم بالذكاء الاصطناعي
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            نظام محاسبة أذكى<br />من أي برنامج آخر
          </h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto mb-10">
            HesabPro يجمع بين قوة المحاسبة الكاملة والذكاء الاصطناعي في منصة SaaS واحدة.
            أسرع، أدق، وأكثر تطوراً من Tally وقبيله.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" variant="default" className="bg-white text-blue-900 hover:bg-blue-50" asChild>
              <Link href="/register">ابدأ مجاناً الآن <ArrowLeft className="h-4 w-4 mr-1" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10" asChild>
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">لماذا HesabPro؟</h2>
          <p className="text-center text-gray-500 mb-12">كل ما تحتاجه لإدارة مالية شركتك بشكل احترافي</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Bot, title: "AI Agent محاسبي", desc: "اسأل عن أرباحك، فواتيرك، وضريبتك بالعربية - تحليل فوري", color: "text-blue-600 bg-blue-100" },
              { icon: BarChart3, title: "تقارير مالية كاملة", desc: "ميزانية عمومية، أرباح وخسائر، ميزان مراجعة في ثوانٍ", color: "text-green-600 bg-green-100" },
              { icon: Shield, title: "محاسبة مزدوجة", desc: "نظام القيد المزدوج الكامل لضمان دقة 100% في السجلات", color: "text-purple-600 bg-purple-100" },
              { icon: Zap, title: "ضريبة القيمة المضافة", desc: "حساب ضريبة القيمة المضافة تلقائياً وتقارير الإقرار الضريبي", color: "text-orange-600 bg-orange-100" },
              { icon: Globe, title: "SaaS متعدد المستأجرين", desc: "إدارة شركات متعددة، مستخدمين وصلاحيات", color: "text-indigo-600 bg-indigo-100" },
              { icon: CheckCircle2, title: "مخزون ومشتريات", desc: "إدارة المخزون، أوامر الشراء والبيع، تسوية بنكية", color: "text-teal-600 bg-teal-100" },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${f.color} mb-4`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">أسعار شفافة وبسيطة</h2>
          <p className="text-center text-gray-500 mb-12">ابدأ مجاناً، وقم بالترقية عند الحاجة</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: "مجاني", price: "0", period: "دائماً", features: ["شركة واحدة", "مستخدم واحد", "100 فاتورة/شهر", "التقارير الأساسية"], cta: "ابدأ مجاناً" },
              { name: "احترافي", price: "299", period: "/شهر", features: ["5 شركات", "20 مستخدم", "غير محدود", "AI Agent", "API Access", "دعم أولوي"], cta: "ابدأ تجربة مجانية", recommended: true },
              { name: "مؤسسي", price: "999", period: "/شهر", features: ["غير محدود", "غير محدود", "غير محدود", "AI متقدم", "SLA 99.9%", "تكامل مخصص"], cta: "تواصل معنا" },
            ].map((p) => (
              <div key={p.name} className={`rounded-xl p-6 ${p.recommended ? "border-2 border-blue-600 bg-blue-50 relative" : "border bg-white"}`}>
                {p.recommended && (
                  <div className="absolute -top-3 right-1/2 translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                    الأكثر شيوعاً
                  </div>
                )}
                <p className="font-bold text-lg mb-2">{p.name}</p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-gray-500 text-sm">ريال{p.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={p.recommended ? "default" : "outline"} asChild>
                  <Link href="/register">{p.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <BookOpen className="h-3 w-3 text-white" />
            </div>
            <span className="text-white font-bold">HesabPro</span>
          </div>
          <p className="text-sm">نظام المحاسبة السحابي الذكي · جميع الحقوق محفوظة © 2024</p>
        </div>
      </footer>
    </div>
  )
}

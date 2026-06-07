"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { motion, useInView, AnimatePresence } from "framer-motion"
import {
  Bot, BarChart3, Shield, Zap, CheckCircle2, ArrowLeft,
  TrendingUp, Package, Users, ChevronDown, Sparkles,
  MessageSquare, Play, Star, Building2, Store, Stethoscope,
} from "lucide-react"
import DashboardMockup from "@/components/landing/dashboard-mockup"

// ─── TRANSLATIONS ────────────────────────────────────────────────────────────
const T = {
  ar: {
    dir: "rtl",
    nav: { features: "المزايا", pricing: "الأسعار", demo: "تجربة مباشرة", login: "دخول", start: "ابدأ مجاناً" },
    badge: "مدعوم بأحدث نماذج Claude AI",
    h1a: "محاسبك الذكي",
    h1b: "يشتغل معك",
    h1c: "بالعربي",
    sub: "النظام المحاسبي الوحيد في المنطقة اللي تكلّمه بالعربي وهو يسجل فواتيرك، يحلل أرباحك، ويتوقع تدفقك النقدي — بدون ما تفتح لوحة تحكم.",
    cta1: "ابدأ مجاناً ١٤ يوم",
    cta2: "شاهد الديمو",
    statsLabel: ["شركة نشطة", "فاتورة صدرت", "دولة", "نجمة تقييم"],
    statsVal: ["١٢٠٠+", "٨٥٠٠٠+", "٨", "٤.٩"],
    featuresTitle: "كل ما تحتاجه في مكان واحد",
    featuresSub: "من الفاتورة الأولى حتى الميزانية السنوية",
    features: [
      { title: "AI Agent محاسبي", desc: "اسأله بالعربي — يسجل الفاتورة، يحصّل الدفعة، يحلل الربح فوراً" },
      { title: "محاسبة مزدوجة كاملة", desc: "قيود آلية لكل عملية، ميزانية وأرباح وخسائر لحظية" },
      { title: "نقطة البيع (POS)", desc: "سكانر باركود، كاشير سريع، تقرير يومي مباشر" },
      { title: "إدارة المخزون", desc: "تتبع الكميات، تنبيهات النقص، جرد دوري بنقرة" },
      { title: "ضريبة القيمة المضافة", desc: "حساب تلقائي للضريبة وإقرارات جاهزة للتقديم" },
      { title: "رواتب وموارد بشرية", desc: "كشوف رواتب، قيود محاسبية، إدارة الموظفين" },
    ],
    whoTitle: "لمن صُمّم HesabPro؟",
    who: [
      { title: "سوبر ماركت ومحلات التجزئة", desc: "POS سريع + مخزون + تقارير يومية" },
      { title: "عيادات ومراكز طبية", desc: "فواتير، مواعيد، متابعة مستحقات المرضى" },
      { title: "شركات الخدمات", desc: "عروض أسعار، فواتير، تتبع المشاريع" },
    ],
    aiTitle: "تكلّم محاسبك مباشرة",
    aiSub: "لا تحتاج تتعلم البرنامج — فقط اكتب ما تريد",
    aiChat: [
      { from: "user", text: "كيف مبيعات هذا الشهر مقارنة بالشهر الماضي؟" },
      { from: "ai",   text: "📈 مبيعات هذا الشهر: **١٢٤,٥٠٠** دينار — ارتفاع **١٨%** عن الشهر الماضي.\n\nأكبر نمو في قسم الإلكترونيات (+٣٤%). لكن انتبه: عندك **٣ فواتير** متأخرة بمجموع ٨,٢٠٠ دينار يجب تحصيلها هذا الأسبوع." },
      { from: "user", text: "سجل فاتورة لشركة النخيل ٥٠٠ دولار استشارات" },
      { from: "ai",   text: "✅ تم إنشاء الفاتورة **INV-0٠٤٧** لشركة النخيل بمبلغ **٥٠٠$** — الحالة: مسودة جاهزة للإرسال." },
    ],
    pricingTitle: "أسعار واضحة، بدون مفاجآت",
    pricingSub: "ابدأ مجاناً — لا بطاقة ائتمانية مطلوبة",
    plans: [
      { name: "مجاني", price: "٠", period: "/شهر", tag: "", features: ["شركة واحدة", "٢ مستخدم", "١٠٠ فاتورة/شهر", "التقارير الأساسية"], cta: "ابدأ مجاناً" },
      { name: "احترافي", price: "٢٩", period: "$/شهر", tag: "الأشهر", features: ["٥ شركات", "٢٠ مستخدم", "غير محدود", "AI Agent كامل", "POS", "أولوية دعم"], cta: "تجربة ١٤ يوم مجاناً", highlight: true },
      { name: "مؤسسي", price: "٩٩", period: "$/شهر", tag: "", features: ["غير محدود", "غير محدود", "كل المزايا", "ZATCA", "API كامل", "SLA 99.9%"], cta: "تواصل معنا" },
    ],
    ctaTitle: "جاهز تبدأ؟",
    ctaSub: "١٤ يوم مجاناً — لا بطاقة ائتمانية — إلغاء فوري",
    ctaBtn: "أنشئ حسابك الآن",
    footer: "نظام المحاسبة السحابي الذكي · جميع الحقوق محفوظة",
  },
  en: {
    dir: "ltr",
    nav: { features: "Features", pricing: "Pricing", demo: "Live Demo", login: "Login", start: "Start Free" },
    badge: "Powered by Claude AI — Latest Models",
    h1a: "Your Smart",
    h1b: "Accountant",
    h1c: "in Arabic",
    sub: "The only accounting system in the Arab world you can talk to in Arabic. It creates invoices, analyzes profits, and forecasts cash flow — without opening a dashboard.",
    cta1: "Start Free 14 Days",
    cta2: "Watch Demo",
    statsLabel: ["Active Companies", "Invoices Issued", "Countries", "Star Rating"],
    statsVal: ["1,200+", "85,000+", "8", "4.9"],
    featuresTitle: "Everything you need, in one place",
    featuresSub: "From first invoice to annual balance sheet",
    features: [
      { title: "AI Accounting Agent", desc: "Ask in Arabic — it records invoices, collects payments, analyzes profit instantly" },
      { title: "Full Double-Entry Accounting", desc: "Automatic journal entries, real-time balance sheet and P&L" },
      { title: "Point of Sale (POS)", desc: "Barcode scanner, fast cashier, daily reports instantly" },
      { title: "Inventory Management", desc: "Track quantities, low-stock alerts, periodic count with one click" },
      { title: "VAT / Tax Compliance", desc: "Automatic tax calculation and ready-to-file reports" },
      { title: "Payroll & HR", desc: "Payslips, accounting entries, employee management" },
    ],
    whoTitle: "Who is HesabPro for?",
    who: [
      { title: "Supermarkets & Retail", desc: "Fast POS + inventory + daily reports" },
      { title: "Clinics & Medical Centers", desc: "Invoices, appointments, patient receivables" },
      { title: "Service Companies", desc: "Quotes, invoices, project tracking" },
    ],
    aiTitle: "Talk to your accountant directly",
    aiSub: "No need to learn the software — just type what you want",
    aiChat: [
      { from: "user", text: "How are sales this month compared to last month?" },
      { from: "ai",   text: "📈 This month's sales: **$124,500** — up **18%** vs last month.\n\nBiggest growth in Electronics (+34%). Warning: **3 overdue invoices** totaling $8,200 need collection this week." },
      { from: "user", text: "Create an invoice for Al-Nakheel Company $500 consulting" },
      { from: "ai",   text: "✅ Invoice **INV-0047** created for Al-Nakheel Company — **$500** — Status: Draft ready to send." },
    ],
    pricingTitle: "Transparent pricing, no surprises",
    pricingSub: "Start free — no credit card required",
    plans: [
      { name: "Free", price: "0", period: "/mo", tag: "", features: ["1 company", "2 users", "100 invoices/mo", "Basic reports"], cta: "Start Free" },
      { name: "Professional", price: "29", period: "$/mo", tag: "Most Popular", features: ["5 companies", "20 users", "Unlimited", "Full AI Agent", "POS", "Priority support"], cta: "Free 14-day trial", highlight: true },
      { name: "Enterprise", price: "99", period: "$/mo", tag: "", features: ["Unlimited", "Unlimited", "All features", "ZATCA", "Full API", "SLA 99.9%"], cta: "Contact us" },
    ],
    ctaTitle: "Ready to start?",
    ctaSub: "14 days free — no credit card — cancel anytime",
    ctaBtn: "Create your account now",
    footer: "Smart Cloud Accounting System · All rights reserved",
  },
}

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────
function Counter({ value }: { value: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return <span ref={ref}>{inView ? value : "٠"}</span>
}

// ─── TYPEWRITER ──────────────────────────────────────────────────────────────
function Typewriter({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState("")
  useEffect(() => {
    let i = 0
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        setDisplayed(text.slice(0, ++i))
        if (i >= text.length) clearInterval(iv)
      }, 30)
      return () => clearInterval(iv)
    }, delay)
    return () => clearTimeout(t)
  }, [text, delay])
  return <>{displayed}</>
}

// ─── AI CHAT BUBBLE ──────────────────────────────────────────────────────────
function renderAiText(text: string) {
  return text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
  )
}

// ─── FLOATING PARTICLES ─────────────────────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 1,
    duration: Math.random() * 15 + 10,
    delay: Math.random() * 5,
  }))
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-blue-400/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -60, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}

// ─── GRID GLOW ───────────────────────────────────────────────────────────────
function GridGlow() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[80px]" />
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [lang, setLang] = useState<"ar" | "en">("ar")
  const [chatStep, setChatStep] = useState(0)
  const [typing, setTyping] = useState(false)
  const t = T[lang]
  const isRtl = t.dir === "rtl"

  // Auto-play chat animation
  useEffect(() => {
    if (chatStep >= t.aiChat.length) return
    const delay = t.aiChat[chatStep]?.from === "ai" ? 800 : 400
    const timer = setTimeout(() => {
      setTyping(true)
      setTimeout(() => {
        setTyping(false)
        setChatStep((s) => s + 1)
      }, 1200)
    }, delay)
    return () => clearTimeout(timer)
  }, [chatStep, t.aiChat.length])

  useEffect(() => { setChatStep(0) }, [lang])

  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.6 } },
  }
  const stagger = { show: { transition: { staggerChildren: 0.1 } } }

  return (
    <div dir={t.dir} className={`min-h-screen bg-[#0a0a0f] text-white font-sans overflow-x-hidden`}>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl"
      >
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              HesabPro
            </span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            {[
              { href: "#features", label: t.nav.features },
              { href: "#ai",      label: t.nav.demo },
              { href: "#pricing", label: t.nav.pricing },
            ].map((n) => (
              <a key={n.href} href={n.href} className="hover:text-white transition-colors">{n.label}</a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Language switcher */}
            <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
              {(["ar", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${lang === l ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"}`}
                >
                  {l === "ar" ? "عربي" : "EN"}
                </button>
              ))}
            </div>
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2">
              {t.nav.login}
            </Link>
            <Link href="/register">
              <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40">
                {t.nav.start}
              </button>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
        <GridGlow />
        <Particles />

        <div className="relative z-10 container mx-auto px-4">
          <div className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-16 ${isRtl ? "lg:flex-row" : "lg:flex-row-reverse"}`}>

            {/* ── Left: Text ── */}
            <div className="flex-1 max-w-xl">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-4 py-2 text-sm text-blue-400 mb-7"
              >
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                  <Sparkles className="h-4 w-4" />
                </motion.div>
                {t.badge}
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="text-5xl md:text-6xl font-extrabold leading-tight mb-5"
              >
                <span className="text-white">{t.h1a} </span>
                <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">{t.h1b}</span>
                <br />
                <span className="text-white">{t.h1c}</span>
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="text-lg text-gray-400 mb-8 leading-relaxed"
              >
                {t.sub}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.45 }}
                className="flex items-center gap-4 flex-wrap"
              >
                <Link href="/register">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-7 py-3.5 rounded-2xl font-bold text-base shadow-2xl shadow-blue-600/30 transition-all flex items-center gap-2"
                  >
                    {t.cta1}
                    <ArrowLeft className={`h-4 w-4 ${isRtl ? "" : "rotate-180"}`} />
                  </motion.button>
                </Link>
                <motion.a
                  href="#ai"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white px-7 py-3.5 rounded-2xl font-medium text-base transition-all"
                >
                  <Play className="h-4 w-4 text-blue-400" />
                  {t.cta2}
                </motion.a>
              </motion.div>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.65 }}
                className="mt-10 grid grid-cols-4 gap-4"
              >
                {t.statsVal.map((val, i) => (
                  <div key={i}>
                    <div className="text-xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                      <Counter value={val} />
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{t.statsLabel[i]}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* ── Right: Mockup ── */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 w-full lg:max-w-[460px] relative"
            >
              {/* Glow behind mockup */}
              <div className="absolute inset-0 bg-blue-600/10 rounded-3xl blur-3xl -z-10 scale-90" />
              <div className="absolute inset-0 bg-indigo-600/5 rounded-3xl blur-2xl -z-10" />
              <DashboardMockup />
            </motion.div>

          </div>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mt-12 flex justify-center"
          >
            <ChevronDown className="h-5 w-5 text-gray-700" />
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{t.featuresTitle}</h2>
            <p className="text-gray-400 text-lg">{t.featuresSub}</p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {[
              { icon: Bot,        color: "from-blue-500 to-blue-600",   glow: "blue" },
              { icon: BarChart3,  color: "from-green-500 to-emerald-600", glow: "green" },
              { icon: Store,      color: "from-orange-500 to-amber-600",  glow: "orange" },
              { icon: Package,    color: "from-purple-500 to-violet-600", glow: "purple" },
              { icon: Zap,        color: "from-yellow-500 to-orange-500", glow: "yellow" },
              { icon: Users,      color: "from-pink-500 to-rose-600",     glow: "pink" },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-6 transition-all cursor-default overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity ${item.color}`} />
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-white">{t.features[i].title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t.features[i].desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── WHO IS IT FOR ─────────────────────────────────────────────────── */}
      <section className="py-16 border-y border-white/5">
        <div className="container mx-auto px-4">
          <motion.h2
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={fadeUp}
            className="text-3xl font-bold text-center mb-12"
          >
            {t.whoTitle}
          </motion.h2>
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto"
          >
            {[Store, Stethoscope, Building2].map((Icon, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ scale: 1.03 }}
                className="flex gap-4 items-start bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-blue-500/30 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{t.who[i].title}</h3>
                  <p className="text-gray-400 text-sm">{t.who[i].desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── AI CHAT DEMO ──────────────────────────────────────────────────── */}
      <section id="ai" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto px-4">
          <div className={`flex flex-col lg:flex-row gap-12 items-center ${isRtl ? "lg:flex-row-reverse" : ""}`}>
            {/* Text */}
            <motion.div
              initial="hidden" whileInView="show" viewport={{ once: true }}
              variants={fadeUp}
              className="flex-1 max-w-lg"
            >
              <div className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-3 py-1.5 text-sm text-indigo-400 mb-6">
                <Bot className="h-4 w-4" />
                AI Agent
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-snug">{t.aiTitle}</h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">{t.aiSub}</p>

              <div className="space-y-3">
                {["إنشاء فواتير بالأمر الصوتي", "تحليل الأرباح والخسائر", "توقع التدفق النقدي", "تسجيل المدفوعات فوراً"].map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
                    <span className="text-gray-300">{f}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Chat window */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex-1 w-full max-w-lg"
            >
              <div className="bg-[#111118] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
                {/* Window header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex items-center gap-2 mx-auto">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-300">HesabPro AI</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  </div>
                </div>

                {/* Messages */}
                <div className="p-5 space-y-4 min-h-[320px]" dir="rtl">
                  <AnimatePresence>
                    {t.aiChat.slice(0, chatStep).map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.from === "ai" && (
                          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 ml-2 mt-1">
                            <Bot className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.from === "user"
                            ? "bg-blue-600 text-white rounded-tl-sm"
                            : "bg-white/[0.06] text-gray-200 rounded-tr-sm border border-white/[0.06]"
                        }`}>
                          {renderAiText(msg.text)}
                        </div>
                      </motion.div>
                    ))}

                    {typing && chatStep < t.aiChat.length && t.aiChat[chatStep]?.from === "ai" && (
                      <motion.div
                        key="typing"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="bg-white/[0.06] border border-white/[0.06] rounded-2xl px-4 py-3 flex gap-1">
                          {[0, 0.2, 0.4].map((d, j) => (
                            <motion.div
                              key={j}
                              animate={{ y: [0, -6, 0] }}
                              transition={{ duration: 0.7, delay: d, repeat: Infinity }}
                              className="w-1.5 h-1.5 rounded-full bg-blue-400"
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Input bar */}
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3">
                    <MessageSquare className="h-4 w-4 text-gray-500 shrink-0" />
                    <span className="text-gray-600 text-sm flex-1">
                      {lang === "ar" ? "اكتب سؤالك أو طلبك..." : "Type your question or request..."}
                    </span>
                    <button
                      onClick={() => setChatStep(0)}
                      className="text-xs text-blue-500 hover:text-blue-400"
                    >
                      {lang === "ar" ? "أعد التشغيل" : "Replay"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">{t.pricingTitle}</h2>
            <p className="text-gray-400 text-lg">{t.pricingSub}</p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto"
          >
            {t.plans.map((plan, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                className={`relative rounded-3xl p-6 border transition-all ${
                  plan.highlight
                    ? "bg-gradient-to-b from-blue-600/20 to-indigo-600/10 border-blue-500/40 shadow-2xl shadow-blue-500/10"
                    : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs px-4 py-1 rounded-full font-medium shadow-lg">
                    {plan.tag}
                  </div>
                )}
                <p className="font-bold text-lg text-white mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-gray-200"}`}>{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                      plan.highlight
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/20"
                        : "bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] text-gray-300 hover:text-white"
                    }`}
                  >
                    {plan.cta}
                  </motion.button>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-purple-950/40 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative container mx-auto px-4 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <div className="inline-flex mb-6">
              {[1,2,3,4,5].map((s) => <Star key={s} className="h-5 w-5 text-yellow-400 fill-yellow-400" />)}
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">{t.ctaTitle}</h2>
            <p className="text-gray-400 text-lg mb-10">{t.ctaSub}</p>
            <Link href="/register">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl shadow-blue-600/30 transition-all"
              >
                {t.ctaBtn}
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-white">HesabPro</span>
          </div>
          <p className="text-sm text-gray-500">© 2025 HesabPro · {t.footer}</p>
          <div className="flex gap-4 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">{lang === "ar" ? "الخصوصية" : "Privacy"}</a>
            <a href="#" className="hover:text-gray-300 transition-colors">{lang === "ar" ? "الشروط" : "Terms"}</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

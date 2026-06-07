"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bot, FileText, Package, ShoppingCart, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, BarChart3, Users } from "lucide-react"

// ─── Fake data ────────────────────────────────────────────────────────────────
const BARS = [42, 61, 55, 73, 68, 85, 91, 78, 95, 88, 112, 124]
const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]

const INVOICES = [
  { num: "INV-0044", name: "شركة الرافدين", amount: "٢٤,٥٠٠", status: "paid" },
  { num: "INV-0045", name: "مؤسسة النخيل", amount: "١١,٢٠٠", status: "sent" },
  { num: "INV-0046", name: "شركة دجلة", amount: "٨,٧٥٠", status: "overdue" },
  { num: "INV-0047", name: "مجموعة الفرات", amount: "٣٢,١٠٠", status: "paid" },
]

const POS_ITEMS = [
  { name: "حليب نيدو ٩٠٠جم", qty: 12, price: "٤,٨٠٠" },
  { name: "زيت دوار الشمس ١.٨ لتر", qty: 8, price: "١٢,٠٠٠" },
  { name: "شاي أحمد ٥٠٠جم", qty: 15, price: "٧,٥٠٠" },
]

const AI_MSGS = [
  { role: "user", text: "كيف أرباح هذا الشهر؟" },
  { role: "ai",   text: "📈 الإيرادات: **١٢٤,٥٠٠** دينار\nارتفاع **+١٨%** عن الشهر الماضي.\n⚠️ ٣ فواتير متأخرة بـ ٨,٢٠٠ دينار" },
  { role: "user", text: "سجل فاتورة للنخيل ٥٠٠$" },
  { role: "ai",   text: "✅ تم إنشاء **INV-0047**\nللعميل: مؤسسة النخيل\nالمبلغ: **٥٠٠$** — مسودة" },
]

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = "dashboard" | "invoices" | "ai" | "pos"

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimNum({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / 40
    const iv = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(iv) }
      else setVal(Math.floor(start))
    }, 30)
    return () => clearInterval(iv)
  }, [target])
  return <span>{prefix}{val.toLocaleString("ar-EG")}{suffix}</span>
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────
function DashboardTab() {
  const maxBar = Math.max(...BARS)
  return (
    <div className="space-y-3" dir="rtl">
      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "الإيرادات", val: 124500, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", change: "+١٨%" },
          { label: "المصروفات", val: 68200,  icon: TrendingDown, color: "text-red-400",   bg: "bg-red-500/10",    change: "+٥%" },
          { label: "الصافي",    val: 56300,  icon: BarChart3,    color: "text-blue-400",  bg: "bg-blue-500/10",   change: "+٣١%" },
        ].map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${m.bg} border border-white/[0.06] rounded-xl p-2.5`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500">{m.label}</span>
              <m.icon className={`h-3 w-3 ${m.color}`} />
            </div>
            <div className={`text-sm font-bold ${m.color}`}>
              <AnimNum target={m.val} />
            </div>
            <div className="text-[9px] text-gray-500 mt-0.5">{m.change} هذا الشهر</div>
          </motion.div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-gray-400 font-medium">الإيرادات الشهرية (ألف دينار)</span>
          <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">+٢٣% YTD</span>
        </div>
        <div className="flex items-end gap-1 h-16">
          {BARS.map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 flex flex-col items-center gap-1"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: "easeOut" }}
              style={{ originY: 1 }}
            >
              <div
                className={`w-full rounded-t-sm ${i === BARS.length - 1 ? "bg-blue-500" : "bg-blue-500/30"}`}
                style={{ height: `${(h / maxBar) * 100}%` }}
              />
            </motion.div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-gray-600">يناير</span>
          <span className="text-[8px] text-gray-600">ديسمبر</span>
        </div>
      </div>

      {/* Alerts */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-2">
          <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
          <span className="text-[9px] text-amber-300">٣ فواتير متأخرة · ٨,٢٠٠ دينار</span>
        </div>
        <div className="flex-1 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-2">
          <Users className="h-3 w-3 text-blue-400 shrink-0" />
          <span className="text-[9px] text-blue-300">٨ موظفين · رواتب: ١٢ يوليو</span>
        </div>
      </div>
    </div>
  )
}

// ─── Invoices tab ──────────────────────────────────────────────────────────────
function InvoicesTab() {
  const statusMap: Record<string, { label: string; cls: string }> = {
    paid:    { label: "مدفوع",  cls: "bg-emerald-500/20 text-emerald-400" },
    sent:    { label: "مرسل",   cls: "bg-blue-500/20 text-blue-400" },
    overdue: { label: "متأخر",  cls: "bg-red-500/20 text-red-400" },
  }
  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-gray-400 font-medium">آخر الفواتير</span>
        <span className="text-[9px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">١٢ هذا الشهر</span>
      </div>
      {INVOICES.map((inv, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5 hover:border-white/[0.1] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <FileText className="h-3 w-3 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-white">{inv.name}</div>
              <div className="text-[9px] text-gray-500">{inv.num}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-200">{inv.amount}</span>
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${statusMap[inv.status].cls}`}>
              {statusMap[inv.status].label}
            </span>
          </div>
        </motion.div>
      ))}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full py-2 border border-dashed border-white/[0.08] rounded-xl text-[9px] text-gray-500 hover:text-gray-400 hover:border-white/[0.15] transition-colors mt-1"
      >
        + فاتورة جديدة
      </motion.button>
    </div>
  )
}

// ─── AI tab ────────────────────────────────────────────────────────────────────
function AITab() {
  const [step, setStep] = useState(0)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    if (step >= AI_MSGS.length) return
    const delay = AI_MSGS[step]?.role === "ai" ? 700 : 300
    const t = setTimeout(() => {
      setTyping(true)
      setTimeout(() => { setTyping(false); setStep(s => s + 1) }, 900)
    }, delay)
    return () => clearTimeout(t)
  }, [step])

  const renderText = (text: string) =>
    text.split(/\*\*(.*?)\*\*/g).map((p, i) =>
      i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>
    )

  return (
    <div className="flex flex-col gap-2.5" dir="rtl">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-[10px] font-medium text-gray-300">HesabPro AI</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      <div className="space-y-2 min-h-[140px]">
        <AnimatePresence>
          {AI_MSGS.slice(0, step).map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[10px] leading-relaxed whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-tl-sm"
                  : "bg-white/[0.06] text-gray-200 border border-white/[0.06] rounded-tr-sm"
              }`}>
                {renderText(msg.text)}
              </div>
            </motion.div>
          ))}
          {typing && step < AI_MSGS.length && AI_MSGS[step]?.role === "ai" && (
            <motion.div key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-white/[0.06] border border-white/[0.06] rounded-xl px-3 py-2 flex gap-1">
                {[0, 0.15, 0.3].map((d, j) => (
                  <motion.div key={j} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, delay: d, repeat: Infinity }}
                    className="w-1 h-1 rounded-full bg-blue-400" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-2.5 py-2 mt-auto">
        <span className="text-[9px] text-gray-600 flex-1">اكتب سؤالك...</span>
        <button onClick={() => setStep(0)} className="text-[8px] text-blue-500">↺</button>
      </div>
    </div>
  )
}

// ─── POS tab ───────────────────────────────────────────────────────────────────
function POSTab() {
  const [total, setTotal] = useState(0)
  useEffect(() => {
    let t = 0
    const iv = setInterval(() => {
      t += 412
      if (t >= 24300) { setTotal(24300); clearInterval(iv) }
      else setTotal(t)
    }, 20)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="space-y-2.5" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-400 font-medium">نقطة البيع — الجلسة الحالية</span>
        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">● مفتوح</span>
      </div>

      {/* Cart items */}
      <div className="space-y-1.5">
        {POS_ITEMS.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center">
                <Package className="h-2.5 w-2.5 text-purple-400" />
              </div>
              <div>
                <div className="text-[9px] text-gray-200">{item.name}</div>
                <div className="text-[8px] text-gray-500">×{item.qty}</div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-gray-200">{item.price}</span>
          </motion.div>
        ))}
      </div>

      {/* Total */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl px-3 py-2.5 flex items-center justify-between"
      >
        <span className="text-[10px] text-gray-300">إجمالي اليوم</span>
        <span className="text-base font-extrabold text-blue-300">
          {total.toLocaleString("ar-EG")} د.ع
        </span>
      </motion.div>

      {/* Payment method */}
      <div className="grid grid-cols-3 gap-1.5">
        {["نقد", "بطاقة", "تحويل"].map((m, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            className={`py-1.5 rounded-lg text-[9px] font-medium transition-all border ${
              i === 0
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-white/[0.03] border-white/[0.08] text-gray-400 hover:bg-white/[0.06]"
            }`}
          >
            {m}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "لوحة التحكم", icon: BarChart3 },
  { id: "invoices",  label: "الفواتير",    icon: FileText },
  { id: "ai",        label: "AI Agent",    icon: Bot },
  { id: "pos",       label: "POS",         icon: ShoppingCart },
]

export default function DashboardMockup() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard")

  // Auto-cycle through tabs
  useEffect(() => {
    const order: Tab[] = ["dashboard", "invoices", "ai", "pos"]
    let idx = 0
    const iv = setInterval(() => {
      idx = (idx + 1) % order.length
      setActiveTab(order[idx])
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="w-full max-w-[420px] mx-auto select-none">
      {/* Outer glow */}
      <div className="absolute inset-0 bg-blue-600/5 rounded-3xl blur-xl -z-10" />

      {/* Window frame */}
      <div className="bg-[#0f0f1a] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl shadow-black/60">

        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white fill-current" viewBox="0 0 16 16">
                  <path d="M8 1l2 5h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5z"/>
                </svg>
              </div>
              <span className="text-[11px] font-semibold text-gray-300">HesabPro</span>
            </div>
          </div>
          <div className="w-12" />
        </div>

        {/* App shell */}
        <div className="flex h-[340px]" dir="rtl">

          {/* Sidebar */}
          <div className="w-10 border-l border-white/[0.05] flex flex-col items-center py-3 gap-3 bg-white/[0.01]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-600 shadow-lg shadow-blue-600/30"
                    : "text-gray-600 hover:text-gray-400 hover:bg-white/[0.05]"
                }`}
                title={tab.label}
              >
                <tab.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-hidden">
            {/* Tab label */}
            <div className="px-3 py-2 border-b border-white/[0.04] flex items-center justify-between">
              <span className="text-[10px] font-medium text-gray-400">
                {TABS.find(t => t.id === activeTab)?.label}
              </span>
              {/* Progress dots */}
              <div className="flex gap-1">
                {TABS.map(t => (
                  <motion.div
                    key={t.id}
                    animate={{ width: activeTab === t.id ? 12 : 4 }}
                    className={`h-1 rounded-full transition-colors ${activeTab === t.id ? "bg-blue-500" : "bg-white/10"}`}
                  />
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="p-3 h-[calc(100%-32px)] overflow-auto scrollbar-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {activeTab === "dashboard" && <DashboardTab />}
                  {activeTab === "invoices"  && <InvoicesTab />}
                  {activeTab === "ai"        && <AITab />}
                  {activeTab === "pos"       && <POSTab />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/[0.04] bg-white/[0.01]">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] text-gray-600">متصل · آمن ١٠٠%</span>
          </div>
          <span className="text-[8px] text-gray-700">v2.1.0</span>
        </div>
      </div>

      {/* Reflection/shadow effect */}
      <div className="h-8 mx-8 bg-gradient-to-b from-blue-900/20 to-transparent rounded-b-3xl blur-sm" />
    </div>
  )
}

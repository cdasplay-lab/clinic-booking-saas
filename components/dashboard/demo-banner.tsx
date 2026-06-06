"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, CheckCircle2, X } from "lucide-react"

export default function DemoBanner() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setDone(true)
        setTimeout(() => window.location.reload(), 1500)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 left-3 text-blue-200 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-white/20 rounded-lg p-2 flex-shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-lg">اللوحة تبدو فارغة!</p>
            <p className="text-blue-100 text-sm mt-0.5">
              حمّل بيانات تجريبية — عملاء، فواتير، تقارير — لترى كيف يبدو النظام عند العمل الفعلي.
            </p>
          </div>
        </div>

        <div className="flex-shrink-0">
          {done ? (
            <div className="flex items-center gap-2 bg-green-500 px-4 py-2 rounded-lg text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              تم! جاري التحديث...
            </div>
          ) : (
            <Button
              onClick={load}
              disabled={loading}
              className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Sparkles className="h-4 w-4 ml-2" />}
              تحميل بيانات تجريبية
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

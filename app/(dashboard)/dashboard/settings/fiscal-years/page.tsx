"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, Lock, CheckCircle2, Plus, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type FY = { id: string; name: string; startDate: string; endDate: string; isClosed: boolean; closedAt: string | null }

export default function FiscalYearsPage() {
  const [years, setYears]   = useState<FY[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState<string | null>(null)
  const [result, setResult]   = useState<{ id: string; netProfit: number } | null>(null)
  const [error, setError]     = useState("")
  const [adding, setAdding]   = useState(false)
  const [form, setForm]       = useState({ name: "", startDate: "", endDate: "" })

  function load() {
    fetch("/api/fiscal-years").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setYears(d)
      setLoading(false)
    })
  }
  useEffect(load, [])

  async function closeYear(id: string, name: string) {
    if (!confirm(`تأكيد إقفال "${name}"؟\n\nسيتم ترحيل الأرباح/الخسائر إلى الأرباح المبقاة وقفل الفترة نهائياً — لن تستطيع التسجيل فيها بعد ذلك.`)) return
    setClosing(id)
    setError("")
    const res = await fetch(`/api/fiscal-years/${id}/close`, { method: "POST" })
    const d = await res.json()
    if (res.ok) {
      setResult({ id, netProfit: d.netProfit ?? 0 })
      load()
    } else {
      setError(d.error || "خطأ")
    }
    setClosing(null)
  }

  async function addYear(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.startDate || !form.endDate) return
    const res = await fetch("/api/fiscal-years", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) { setForm({ name: "", startDate: "", endDate: "" }); setAdding(false); load() }
  }

  if (loading) return <div className="flex justify-center pt-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/settings"><ArrowRight className="h-4 w-4" /> الإعدادات</Link>
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">السنوات المالية</h1>
          <p className="text-sm text-gray-500">إدارة وإقفال السنوات المالية</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" /> سنة جديدة
        </Button>
      </div>

      {adding && (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={addYear} className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-gray-500 block mb-1">الاسم</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="السنة المالية 2026" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">من</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">إلى</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <Button type="submit" size="sm">حفظ</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="space-y-3">
        {years.length === 0 ? (
          <p className="text-center text-gray-400 py-8">لا توجد سنوات مالية</p>
        ) : (
          years.map((fy) => (
            <Card key={fy.id} className={fy.isClosed ? "bg-gray-50" : ""}>
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{fy.name}</p>
                    {fy.isClosed
                      ? <Badge variant="secondary"><Lock className="h-3 w-3 ml-1" /> مقفلة</Badge>
                      : <Badge variant="success">مفتوحة</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(fy.startDate).toLocaleDateString("ar-AE")} — {new Date(fy.endDate).toLocaleDateString("ar-AE")}
                  </p>
                  {result?.id === fy.id && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      تم الإقفال — صافي {result.netProfit >= 0 ? "الربح" : "الخسارة"}: {formatCurrency(Math.abs(result.netProfit))}
                    </p>
                  )}
                </div>
                {!fy.isClosed && (
                  <Button variant="outline" size="sm" onClick={() => closeYear(fy.id, fy.name)} disabled={closing === fy.id}
                    className="text-amber-700 border-amber-200 hover:bg-amber-50">
                    {closing === fy.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    إقفال السنة
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Plus, ArrowRight, ClipboardList, CheckCircle2, Lock } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type Count = {
  id: string; number: string; status: string; notes: string | null
  createdAt: string; postedAt: string | null
  warehouse: { name: string }
  _count: { lines: number }
}

export default function StockCountsPage() {
  const [counts, setCounts] = useState<Count[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [notes, setNotes] = useState("")
  const [showForm, setShowForm] = useState(false)

  function load() {
    fetch("/api/stock-counts").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setCounts(d)
      setLoading(false)
    })
  }
  useEffect(load, [])

  async function startCount() {
    setCreating(true)
    const res = await fetch("/api/stock-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || null }),
    })
    if (res.ok) {
      const d = await res.json()
      window.location.href = `/dashboard/inventory/count/${d.id}`
    }
    setCreating(false)
  }

  if (loading) return <div className="flex justify-center pt-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/inventory"><ArrowRight className="h-4 w-4" /> المخزون</Link>
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الجرد الفعلي</h1>
          <p className="text-sm text-gray-500">عدّ المخزون وتسوية الفروقات</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> جرد جديد
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm text-gray-600">يتم فتح جلسة جرد لكل المنتجات المخزنة مع كمياتها الحالية في النظام.</p>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="ملاحظات (اختياري)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button onClick={startCount} disabled={creating} className="w-full">
              {creating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ClipboardList className="h-4 w-4 ml-2" />}
              بدء الجرد
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {counts.length === 0 ? (
          <p className="text-center text-gray-400 py-12">لا توجد جردات بعد</p>
        ) : (
          counts.map((c) => (
            <Card key={c.id} className={c.status === "POSTED" ? "bg-gray-50" : ""}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{c.number}</p>
                    {c.status === "POSTED"
                      ? <Badge variant="secondary"><Lock className="h-3 w-3 ml-1" />مرحّل</Badge>
                      : <Badge variant="outline" className="border-amber-400 text-amber-700">مسودة</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.warehouse.name} · {c._count.lines} منتج
                    {c.notes && <> · {c.notes}</>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString("ar-AE")}
                    {c.postedAt && <> — رُحِّل {new Date(c.postedAt).toLocaleDateString("ar-AE")}</>}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/inventory/count/${c.id}`}>
                    {c.status === "POSTED" ? "عرض" : "متابعة الجرد"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

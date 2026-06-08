"use client"
import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, Save, Lock, AlertTriangle, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type Line = {
  id: string
  systemQty: number
  countedQty: number
  variance: number
  unitCost: number
  product: { id: string; name: string; code: string; unit: string }
}
type StockCount = {
  id: string; number: string; status: string; notes: string | null
  postedAt: string | null; warehouse: { name: string }; lines: Line[]
}

export default function StockCountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [count, setCount] = useState<StockCount | null>(null)
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Record<string, string>>({}) // lineId → enteredQty string
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [postResult, setPostResult] = useState<{ linesAdjusted: number; totalAdjValue: number } | null>(null)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<"all" | "diff">("all")

  useEffect(() => {
    fetch(`/api/stock-counts/${id}`)
      .then((r) => r.json())
      .then((d: StockCount) => {
        setCount(d)
        const init: Record<string, string> = {}
        for (const l of d.lines) init[l.id] = String(Number(l.countedQty))
        setCounts(init)
        setLoading(false)
      })
  }, [id])

  const lines = count?.lines ?? []
  const displayLines = filter === "diff"
    ? lines.filter((l) => {
        const counted = parseFloat(counts[l.id] ?? String(Number(l.countedQty))) || 0
        return Math.abs(counted - Number(l.systemQty)) > 0.001
      })
    : lines

  const totalVarianceValue = lines.reduce((sum, l) => {
    const counted = parseFloat(counts[l.id] ?? String(Number(l.countedQty))) || 0
    const variance = counted - Number(l.systemQty)
    return sum + variance * Number(l.unitCost)
  }, 0)

  async function save() {
    setSaving(true); setSaved(false); setError("")
    const payload = Object.entries(counts).map(([lineId, qty]) => ({
      id: lineId,
      countedQty: parseFloat(qty) || 0,
    }))
    const res = await fetch(`/api/stock-counts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", lines: payload }),
    })
    setSaving(false)
    if (res.ok) setSaved(true)
    else setError("خطأ في الحفظ")
  }

  async function post() {
    if (!confirm("تأكيد ترحيل الجرد؟ سيتم إنشاء قيد تسوية للفروقات وقفل الجرد نهائياً.")) return
    setPosting(true); setError("")
    await save() // ensure latest counts are saved first
    const res = await fetch(`/api/stock-counts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "post" }),
    })
    const d = await res.json()
    if (res.ok) {
      setPostResult(d)
      setCount((prev) => prev ? { ...prev, status: "POSTED", postedAt: new Date().toISOString() } : prev)
    } else {
      setError(d.error || "خطأ في الترحيل")
    }
    setPosting(false)
  }

  if (loading) return <div className="flex justify-center pt-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  if (!count) return <p className="text-center text-gray-400 pt-12">جرد غير موجود</p>

  const isPosted = count.status === "POSTED"

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/inventory/count"><ArrowRight className="h-4 w-4" /> الجردات</Link>
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{count.number}</h1>
            {isPosted
              ? <Badge variant="secondary"><Lock className="h-3 w-3 ml-1" /> مرحّل</Badge>
              : <Badge variant="outline" className="border-amber-400 text-amber-700">مسودة</Badge>}
          </div>
          <p className="text-sm text-gray-500">{count.warehouse.name}{count.notes && ` · ${count.notes}`}</p>
        </div>

        {!isPosted && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={save} disabled={saving || posting}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ
            </Button>
            <Button size="sm" onClick={post} disabled={saving || posting}
              className="bg-green-600 hover:bg-green-700">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              ترحيل الجرد
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {saved && !error && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> تم الحفظ
        </div>
      )}
      {postResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          ✅ تم الترحيل — {postResult.linesAdjusted} بند تم تسويته،
          قيمة الفروقات: {formatCurrency(Math.abs(postResult.totalAdjValue))}
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-gray-500">إجمالي المنتجات</p>
          <p className="text-xl font-bold">{lines.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-gray-500">فروقات</p>
          <p className="text-xl font-bold text-amber-600">
            {lines.filter((l) => {
              const c = parseFloat(counts[l.id] ?? String(Number(l.countedQty))) || 0
              return Math.abs(c - Number(l.systemQty)) > 0.001
            }).length}
          </p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-gray-500">قيمة الفروقات</p>
          <p className={`text-xl font-bold ${totalVarianceValue < 0 ? "text-red-600" : "text-green-600"}`}>
            {formatCurrency(Math.abs(totalVarianceValue))}
          </p>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>الكل</Button>
        <Button size="sm" variant={filter === "diff" ? "default" : "outline"} onClick={() => setFilter("diff")}>
          الفروقات فقط
        </Button>
      </div>

      {/* Lines table */}
      <Card>
        <CardHeader><CardTitle className="text-base">بنود الجرد</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">الكود</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">الاسم</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">النظام</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">المعدود</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">الفرق</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayLines.map((line) => {
                  const counted = parseFloat(counts[line.id] ?? String(Number(line.countedQty))) || 0
                  const variance = counted - Number(line.systemQty)
                  const value = variance * Number(line.unitCost)
                  const hasDiff = Math.abs(variance) > 0.001

                  return (
                    <tr key={line.id} className={hasDiff ? "bg-amber-50" : ""}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{line.product.code}</td>
                      <td className="px-4 py-2 font-medium">{line.product.name}</td>
                      <td className="px-4 py-2 text-center text-gray-600">
                        {Number(line.systemQty).toLocaleString()} {line.product.unit}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {isPosted ? (
                          <span>{Number(line.countedQty).toLocaleString()}</span>
                        ) : (
                          <Input
                            type="number"
                            className="h-8 w-24 text-center mx-auto"
                            value={counts[line.id] ?? String(Number(line.countedQty))}
                            onChange={(e) => {
                              setSaved(false)
                              setCounts((prev) => ({ ...prev, [line.id]: e.target.value }))
                            }}
                            min="0"
                            step="1"
                          />
                        )}
                      </td>
                      <td className={`px-4 py-2 text-center font-bold ${variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : "text-gray-400"}`}>
                        {hasDiff ? (variance > 0 ? `+${variance}` : variance) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-left text-xs font-medium ${value > 0 ? "text-green-600" : value < 0 ? "text-red-600" : "text-gray-400"}`}>
                        {hasDiff ? formatCurrency(Math.abs(value)) : ""}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

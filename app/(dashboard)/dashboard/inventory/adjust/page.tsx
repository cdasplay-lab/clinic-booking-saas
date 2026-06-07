"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import Link from "next/link"

type ProductRow = {
  id: string; code: string; name: string; unit: string
  category: string | null; reorderLevel: number; currentStock: number; newQty: string
}

export default function StockAdjustPage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [done, setDone]         = useState(false)
  const [changed, setChanged]   = useState(0)

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
    ]).then(([prods]) => {
      // Fetch stock for each product via inventory page query
      fetch("/api/pos/products?q=").then((r) => r.json()).then((stockData: any[]) => {
        const stockMap: Record<string, number> = {}
        stockData.forEach((p) => { stockMap[p.id] = p.stock })

        setProducts(
          (prods as any[]).map((p) => ({
            id:           p.id,
            code:         p.code,
            name:         p.name,
            unit:         p.unit,
            category:     p.category,
            reorderLevel: Number(p.reorderLevel),
            currentStock: stockMap[p.id] ?? 0,
            newQty:       String(stockMap[p.id] ?? 0),
          }))
        )
        setLoading(false)
      })
    })
  }, [])

  function updateNewQty(id: string, val: string) {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, newQty: val } : p))
  }

  async function handleSave() {
    const adjustments = products
      .filter((p) => Number(p.newQty) !== p.currentStock && p.newQty !== "")
      .map((p) => ({ productId: p.id, newQty: Number(p.newQty) }))

    if (adjustments.length === 0) return

    setSaving(true)
    const res = await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adjustments }),
    })
    const data = await res.json()
    if (res.ok) {
      setChanged(data.adjusted)
      setDone(true)
    }
    setSaving(false)
  }

  const dirtyCount = products.filter((p) => Number(p.newQty) !== p.currentStock && p.newQty !== "").length

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-xl font-bold">تم تعديل المخزون</h2>
        <p className="text-gray-500">تم تحديث {changed} منتج</p>
        <Button onClick={() => router.push("/dashboard/inventory")}>العودة للمخزون</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/inventory"><ArrowRight className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">جرد وتعديل المخزون</h1>
          <p className="text-sm text-gray-500">أدخل الكميات الفعلية لتحديث المخزون</p>
        </div>
        <Button onClick={handleSave} disabled={saving || dirtyCount === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
          حفظ التعديلات {dirtyCount > 0 ? `(${dirtyCount})` : ""}
        </Button>
      </div>

      {dirtyCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          يوجد {dirtyCount} منتج بكميات مختلفة — اضغط "حفظ التعديلات" لتطبيقها
        </div>
      )}

      {loading ? (
        <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">المنتجات — {products.length} منتج</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead className="text-left">الكمية الحالية</TableHead>
                  <TableHead className="text-left w-36">الكمية الفعلية</TableHead>
                  <TableHead className="text-left">الفرق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const newVal = p.newQty === "" ? p.currentStock : Number(p.newQty)
                  const diff   = newVal - p.currentStock
                  const changed = diff !== 0
                  return (
                    <TableRow key={p.id} className={changed ? "bg-amber-50" : ""}>
                      <TableCell className="font-mono text-sm">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-gray-400 text-sm">{p.category || "—"}</TableCell>
                      <TableCell className="text-left text-gray-500">{p.currentStock} {p.unit}</TableCell>
                      <TableCell className="text-left">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={p.newQty}
                          onChange={(e) => updateNewQty(p.id, e.target.value)}
                          className={`h-8 w-28 text-center font-mono ${changed ? "border-amber-400 bg-amber-50" : ""}`}
                        />
                      </TableCell>
                      <TableCell className={`text-left font-medium text-sm ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-300"}`}>
                        {diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

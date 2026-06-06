"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function NewProductPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    code: "", name: "", description: "", unit: "PCS",
    category: "", salePrice: "0", purchasePrice: "0", reorderLevel: "0",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error); setLoading(false) }
    else router.push("/dashboard/inventory")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/inventory"><ArrowRight className="h-4 w-4" /> المخزون</Link>
      </Button>
      <Card>
        <CardHeader><CardTitle>منتج/خدمة جديدة</CardTitle></CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>الكود *</Label><Input value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} required /></div>
              <div className="space-y-2"><Label>الوحدة</Label><Input value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})} /></div>
              <div className="col-span-2 space-y-2"><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /></div>
              <div className="space-y-2"><Label>الفئة</Label><Input value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} /></div>
              <div className="space-y-2"><Label>حد إعادة الطلب</Label><Input type="number" value={form.reorderLevel} onChange={(e) => setForm({...form, reorderLevel: e.target.value})} /></div>
              <div className="space-y-2"><Label>سعر البيع</Label><Input type="number" step="0.01" value={form.salePrice} onChange={(e) => setForm({...form, salePrice: e.target.value})} /></div>
              <div className="space-y-2"><Label>سعر الشراء</Label><Input type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({...form, purchasePrice: e.target.value})} /></div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />} حفظ المنتج
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}

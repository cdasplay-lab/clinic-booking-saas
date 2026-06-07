"use client"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function EditProductPage() {
  const router = useRouter()
  const { id }  = useParams<{ id: string }>()
  const [form, setForm] = useState({
    code: "", name: "", description: "", unit: "PCS",
    category: "", salePrice: "0", purchasePrice: "0",
    reorderLevel: "0", barcode: "",
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")
  const [success, setSuccess]   = useState(false)

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((p) => {
        setForm({
          code:          p.code          ?? "",
          name:          p.name          ?? "",
          description:   p.description   ?? "",
          unit:          p.unit          ?? "PCS",
          category:      p.category      ?? "",
          salePrice:     String(p.salePrice     ?? 0),
          purchasePrice: String(p.purchasePrice ?? 0),
          reorderLevel:  String(p.reorderLevel  ?? 0),
          barcode:       p.barcode       ?? "",
        })
        setLoading(false)
      })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error || "خطأ في الحفظ")
      setSaving(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push("/dashboard/inventory"), 800)
    }
  }

  if (loading) return <div className="flex justify-center pt-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/inventory"><ArrowRight className="h-4 w-4" /> المخزون</Link>
      </Button>
      <Card>
        <CardHeader><CardTitle>تعديل المنتج — {form.name}</CardTitle></CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error   && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-md text-sm">تم الحفظ ✓</div>}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الكود</Label>
                <Input value={form.code} disabled className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label>الوحدة</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>الاسم *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>الباركود</Label>
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="امسح الباركود أو اكتبه..." className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>حد إعادة الطلب</Label>
                <Input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>سعر البيع</Label>
                <Input type="number" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>سعر الشراء / التكلفة</Label>
                <Input type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                حفظ التعديلات
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/inventory">إلغاء</Link>
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}

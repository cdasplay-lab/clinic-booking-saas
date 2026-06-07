"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Plus, Trash2, ArrowRight } from "lucide-react"
import Link from "next/link"

interface Item {
  description: string
  quantity: string
  unitPrice: string
  total: number
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const today = new Date().toISOString().split("T")[0]
  const in14  = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]

  const [vendors, setVendors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [form, setForm] = useState({ contactId: "", date: today, expectedDate: in14, notes: "" })
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", unitPrice: "0", total: 0 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/contacts?type=VENDOR").then((r) => r.json()).then(setVendors).catch(console.error)
    fetch("/api/products").then((r) => r.json()).then(setProducts).catch(console.error)
  }, [])

  function updateItem(i: number, field: keyof Item, value: string) {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: value }
    const qty   = parseFloat(updated[i].quantity)  || 0
    const price = parseFloat(updated[i].unitPrice) || 0
    updated[i].total = Math.round(qty * price * 100) / 100
    setItems(updated)
  }

  function applyProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    const updated = [...items]
    updated[i] = { ...updated[i], description: p.name, unitPrice: String(Number(p.costPrice || p.price)), total: Math.round(Number(p.costPrice || p.price) * parseFloat(updated[i].quantity || "1") * 100) / 100 }
    setItems(updated)
  }

  const subtotal = items.reduce((s, i) => s + i.total, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contactId) { setError("يجب اختيار المورد"); return }
    if (items.some((i) => !i.description)) { setError("جميع البنود تحتاج وصفاً"); return }

    setLoading(true)
    setError("")
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        items: items.map((i) => ({
          description: i.description,
          quantity: parseFloat(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice) || 0,
        })),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push("/dashboard/purchase-orders")
    } else {
      setError(data.error || "حدث خطأ")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/purchase-orders">
            <ArrowRight className="h-4 w-4 ml-1" /> أوامر الشراء
          </Link>
        </Button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold">أمر شراء جديد</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">معلومات الأمر</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>المورد *</Label>
              <select
                value={form.contactId}
                onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">اختر المورد</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الأمر *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>موعد الاستلام المتوقع</Label>
              <Input type="date" value={form.expectedDate} onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">البنود</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "0", total: 0 }])}>
              <Plus className="h-4 w-4 ml-1" /> إضافة بند
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الوصف *</TableHead>
                  <TableHead className="w-24">الكمية</TableHead>
                  <TableHead className="w-28">السعر</TableHead>
                  <TableHead className="w-28 text-left">الإجمالي</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <select
                        value=""
                        onChange={(e) => applyProduct(i, e.target.value)}
                        className="w-36 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none"
                      >
                        <option value="">اختر...</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="وصف البند" className="min-w-[160px]" required />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="w-20" dir="ltr" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)} className="w-24" dir="ltr" />
                    </TableCell>
                    <TableCell className="text-left font-medium">
                      {item.total.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end px-4 py-3 border-t bg-gray-50">
            <div className="text-sm font-semibold">
              الإجمالي: <span className="text-blue-700 text-base mr-2">{subtotal.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="شروط الدفع، تعليمات الشحن..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          حفظ الأمر
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/purchase-orders">إلغاء</Link>
        </Button>
      </div>
    </form>
  )
}

"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Plus, Trash2, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function NewBillPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<any[]>([])
  const [taxRates, setTaxRates] = useState<any[]>([])
  const [form, setForm] = useState({
    contactId: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    vendorRef: "",
    notes: "",
  })
  const [items, setItems] = useState([{ description: "", quantity: "1", unitPrice: "0", taxRateId: "", taxAmount: 0, total: 0 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/contacts?type=VENDOR").then((r) => r.json()).then(setContacts).catch(console.error)
    fetch("/api/tax-rates").then((r) => r.json()).then(setTaxRates).catch(console.error)
  }, [])

  function updateItem(index: number, field: string, value: string) {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    const qty = parseFloat(updated[index].quantity) || 0
    const price = parseFloat(updated[index].unitPrice) || 0
    const subtotal = qty * price
    const tax = taxRates.find((t) => t.id === updated[index].taxRateId)
    const taxAmt = tax ? Math.round(subtotal * (Number(tax.rate) / 100) * 100) / 100 : 0
    updated[index].taxAmount = taxAmt
    updated[index].total = Math.round((subtotal + taxAmt) * 100) / 100
    setItems(updated)
  }

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0)
  const taxTotal = items.reduce((s, i) => s + i.taxAmount, 0)
  const total = subtotal + taxTotal

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contactId) { setError("اختر المورد أولاً"); return }
    setLoading(true)
    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, items }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "حدث خطأ"); setLoading(false) }
    else router.push(`/dashboard/bills`)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/bills"><ArrowRight className="h-4 w-4" /> فواتير الموردين</Link>
      </Button>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>فاتورة مورد جديدة</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>المورد *</Label>
                <Select value={form.contactId} onValueChange={(v) => setForm({...form, contactId: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>{contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>التاريخ</Label><Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} /></div>
              <div className="space-y-2"><Label>الاستحقاق</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({...form, dueDate: e.target.value})} /></div>
              <div className="col-span-2 space-y-2"><Label>رقم مرجع المورد</Label><Input value={form.vendorRef} onChange={(e) => setForm({...form, vendorRef: e.target.value})} /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex justify-between">
              <CardTitle>البنود</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { description: "", quantity: "1", unitPrice: "0", taxRateId: "", taxAmount: 0, total: 0 }])}><Plus className="h-4 w-4" /> إضافة بند</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>الوصف</TableHead><TableHead className="w-24">الكمية</TableHead><TableHead className="w-32">السعر</TableHead><TableHead className="w-40">الضريبة</TableHead><TableHead className="w-32 text-left">الإجمالي</TableHead><TableHead className="w-12"></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell><Input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="وصف" /></TableCell>
                    <TableCell><Input type="number" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} /></TableCell>
                    <TableCell><Input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)} step="0.01" /></TableCell>
                    <TableCell>
                      <Select value={item.taxRateId} onValueChange={(v) => updateItem(i, "taxRateId", v)}>
                        <SelectTrigger><SelectValue placeholder="بدون ضريبة" /></SelectTrigger>
                        <SelectContent><SelectItem value="">بدون</SelectItem>{taxRates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-left font-medium">{item.total.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => items.length > 1 && setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 border-t pt-4 max-w-xs mr-auto space-y-1">
              <div className="flex justify-between text-sm"><span>المجموع الفرعي:</span><span>{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>الضريبة:</span><span>{taxTotal.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>الإجمالي:</span><span>{total.toFixed(2)} ريال</span></div>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}حفظ الفاتورة</Button>
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/bills")}>إلغاء</Button>
        </div>
      </form>
    </div>
  )
}

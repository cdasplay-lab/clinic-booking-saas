"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Plus, Trash2, Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"

interface Contact { id: string; name: string }
interface TaxRate { id: string; name: string; rate: number }
interface Item { description: string; quantity: string; unitPrice: string; taxRateId: string }

const frequencies = [
  { value: "WEEKLY",    label: "أسبوعياً" },
  { value: "MONTHLY",   label: "شهرياً" },
  { value: "QUARTERLY", label: "ربع سنوي" },
  { value: "YEARLY",    label: "سنوياً" },
]

export default function NewRecurringPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [title, setTitle] = useState("")
  const [contactId, setContactId] = useState("")
  const [frequency, setFrequency] = useState("MONTHLY")
  const [dueDays, setDueDays] = useState("30")
  const [nextDate, setNextDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<Item[]>([
    { description: "", quantity: "1", unitPrice: "", taxRateId: "" },
  ])

  useEffect(() => {
    fetch("/api/contacts?type=CUSTOMER").then((r) => r.json()).then(setContacts)
    fetch("/api/tax-rates").then((r) => r.json()).then(setTaxRates).catch(() => {})
  }, [])

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "", taxRateId: "" }])
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: keyof Item, value: string) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, contactId, frequency, dueDays: Number(dueDays), nextDate, endDate: endDate || null, notes, items }),
    })
    const data = await res.json()

    if (res.ok) {
      router.push("/dashboard/recurring")
    } else {
      setError(data.error || "فشل الحفظ")
      setLoading(false)
    }
  }

  const total = items.reduce((sum, item) => {
    const sub = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
    const tr = taxRates.find((t) => t.id === item.taxRateId)
    return sum + sub + sub * (tr ? tr.rate / 100 : 0)
  }, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/recurring"><ArrowRight className="h-4 w-4" /> الفواتير المتكررة</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <RefreshCw className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-bold">فاتورة متكررة جديدة</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">عنوان الفاتورة المتكررة *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: اشتراك شهري — شركة الأمل"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">العميل *</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختر العميل</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">التكرار *</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {frequencies.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">تاريخ أول إصدار *</label>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">تاريخ الانتهاء (اختياري)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">أيام الاستحقاق</label>
                <input
                  type="number"
                  value={dueDays}
                  onChange={(e) => setDueDays(e.target.value)}
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">البنود</p>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> إضافة بند
              </Button>
            </div>

            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    placeholder="الوصف *"
                    required
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", e.target.value)}
                    placeholder="الكمية"
                    min="0.01"
                    step="any"
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                    placeholder="السعر"
                    min="0"
                    step="any"
                    required
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={item.taxRateId}
                    onChange={(e) => updateItem(i, "taxRateId", e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">لا ضريبة</option>
                    {taxRates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 flex justify-center pt-1">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="text-left pt-2 border-t">
              <p className="text-sm text-gray-500">الإجمالي التقريبي لكل دورة</p>
              <p className="text-xl font-bold text-blue-700">{total.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/recurring">إلغاء</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            حفظ الفاتورة المتكررة
          </Button>
        </div>
      </form>
    </div>
  )
}

"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function NewPaymentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get("invoiceId")
  const billId = searchParams.get("billId")

  const [contacts, setContacts] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [form, setForm] = useState({
    contactId: "", invoiceId: invoiceId || "", billId: billId || "",
    type: invoiceId ? "INCOMING" : billId ? "OUTGOING" : "INCOMING",
    date: new Date().toISOString().split("T")[0],
    amount: "", method: "BANK_TRANSFER", reference: "", notes: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/contacts").then((r) => r.json()).then(setContacts).catch(console.error)
    fetch("/api/invoices").then((r) => r.json()).then(setInvoices).catch(console.error)
    fetch("/api/bills").then((r) => r.json()).then(setBills).catch(console.error)

    if (invoiceId) {
      fetch(`/api/invoices/${invoiceId}`).then((r) => r.json()).then((inv) => {
        setForm((f) => ({ ...f, contactId: inv.contactId, amount: String(inv.amountDue) }))
      }).catch(console.error)
    }
  }, [invoiceId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("أدخل المبلغ"); return }
    setLoading(true)
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error); setLoading(false) }
    else router.push("/dashboard/payments")
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/payments"><ArrowRight className="h-4 w-4" /> المدفوعات</Link>
      </Button>
      <Card>
        <CardHeader><CardTitle>تسجيل دفعة</CardTitle></CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

            <div className="space-y-2">
              <Label>نوع الدفعة</Label>
              <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOMING">وارد (من عميل)</SelectItem>
                  <SelectItem value="OUTGOING">صادر (لمورد)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === "INCOMING" && (
              <div className="space-y-2">
                <Label>الفاتورة (اختياري)</Label>
                <Select value={form.invoiceId} onValueChange={(v) => setForm({...form, invoiceId: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر فاتورة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون فاتورة</SelectItem>
                    {invoices.filter((i) => ["SENT","PARTIAL","OVERDUE"].includes(i.status)).map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.number} - {i.contact?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.type === "OUTGOING" && (
              <div className="space-y-2">
                <Label>فاتورة المورد (اختياري)</Label>
                <Select value={form.billId} onValueChange={(v) => setForm({...form, billId: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر فاتورة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون فاتورة</SelectItem>
                    {bills.filter((b) => ["OPEN","PARTIAL","OVERDUE"].includes(b.status)).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.number} - {b.contact?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>المبلغ *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={form.method} onValueChange={(v) => setForm({...form, method: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">تحويل بنكي</SelectItem>
                  <SelectItem value="CASH">نقداً</SelectItem>
                  <SelectItem value="CHECK">شيك</SelectItem>
                  <SelectItem value="CREDIT_CARD">بطاقة ائتمان</SelectItem>
                  <SelectItem value="ONLINE">دفع إلكتروني</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>رقم المرجع</Label>
              <Input value={form.reference} onChange={(e) => setForm({...form, reference: e.target.value})} placeholder="رقم التحويل أو الشيك" />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />} تسجيل الدفعة
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}

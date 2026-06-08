"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight } from "lucide-react"
import { PRICE_LEVELS } from "@/lib/pricing"
import Link from "next/link"

export default function NewCustomerPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "", email: "", phone: "", taxNumber: "",
    address: "", type: "CUSTOMER", paymentTerms: "30",
    priceLevel: "RETAIL", creditLimit: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || "حدث خطأ")
      setLoading(false)
    } else {
      router.push("/dashboard/contacts/customers")
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/contacts/customers"><ArrowRight className="h-4 w-4" /> العملاء</Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>إضافة عميل جديد</CardTitle></CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>اسم العميل *</Label>
                <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>الرقم الضريبي</Label>
                <Input value={form.taxNumber} onChange={(e) => setForm({...form, taxNumber: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>شروط الدفع (أيام)</Label>
                <Input type="number" value={form.paymentTerms} onChange={(e) => setForm({...form, paymentTerms: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>مستوى السعر</Label>
                <Select value={form.priceLevel} onValueChange={(v) => setForm({...form, priceLevel: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRICE_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>حد الائتمان</Label>
                <Input type="number" min="0" step="0.01" placeholder="اتركه فارغاً = بلا حد"
                  value={form.creditLimit} onChange={(e) => setForm({...form, creditLimit: e.target.value})} />
                <p className="text-xs text-gray-400">النظام يمنع البيع الآجل عند تجاوز هذا الحد</p>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>العنوان</Label>
                <Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              حفظ العميل
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}

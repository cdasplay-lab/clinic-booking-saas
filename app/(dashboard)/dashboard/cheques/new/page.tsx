"use client"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, ArrowDownLeft, ArrowUpRight } from "lucide-react"

function NewChequeForm() {
  const router = useRouter()
  const params = useSearchParams()
  const initialType = params.get("type") === "OUTGOING" ? "OUTGOING" : "INCOMING"

  const [type, setType] = useState<"INCOMING" | "OUTGOING">(initialType)
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    chequeNumber: "", bankName: "", partyName: "", amount: "",
    issueDate: today, dueDate: today, contactName: "", bankAccountId: "", notes: "",
  })

  useEffect(() => {
    fetch("/api/banking").then((r) => r.ok ? r.json() : []).then((data) => {
      if (Array.isArray(data)) setBanks(data.map((b: any) => ({ id: b.id, name: b.name })))
    }).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.chequeNumber || !form.partyName || !form.amount) {
      setError("رقم الشيك، الطرف، والمبلغ مطلوبة")
      return
    }
    setSaving(true)
    const res = await fetch("/api/cheques", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        chequeNumber: form.chequeNumber,
        bankName: form.bankName || null,
        partyName: form.partyName,
        amount: form.amount,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        contactName: form.contactName || null,
        bankAccountId: form.bankAccountId || null,
        notes: form.notes || null,
      }),
    })
    if (res.ok) {
      router.push("/dashboard/cheques")
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error || "خطأ في الحفظ")
      setSaving(false)
    }
  }

  const isIncoming = type === "INCOMING"

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/cheques"><ArrowRight className="h-4 w-4" /> الشيكات</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>تسجيل شيك جديد</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("INCOMING")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                  isIncoming ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" /> شيك وارد (من عميل)
              </button>
              <button
                type="button"
                onClick={() => setType("OUTGOING")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                  !isIncoming ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500"
                }`}
              >
                <ArrowUpRight className="h-4 w-4" /> شيك صادر (لمورد)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم الشيك *</Label>
                <Input value={form.chequeNumber} onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })}
                  className="font-mono" placeholder="123456" />
              </div>
              <div className="space-y-2">
                <Label>اسم البنك</Label>
                <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="Emirates NBD ..." />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>{isIncoming ? "الساحب (اسم العميل على الشيك) *" : "المستفيد (اسم المورد) *"}</Label>
                <Input value={form.partyName} onChange={(e) => setForm({ ...form, partyName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>المبلغ *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>ربط بجهة اتصال (اختياري)</Label>
                <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="يُنشأ تلقائياً إن لم يوجد" />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الإصدار</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الاستحقاق *</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>الحساب البنكي {isIncoming ? "للإيداع" : "للصرف"} (اختياري)</Label>
                <select
                  value={form.bankAccountId}
                  onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                  className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm"
                >
                  <option value="">— اختر لاحقاً عند التحصيل —</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>ملاحظات</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                تسجيل الشيك
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/cheques">إلغاء</Link>
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}

export default function NewChequePage() {
  return (
    <Suspense fallback={<div className="flex justify-center pt-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}>
      <NewChequeForm />
    </Suspense>
  )
}

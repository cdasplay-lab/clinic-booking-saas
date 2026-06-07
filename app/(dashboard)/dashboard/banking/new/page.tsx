"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, Building2 } from "lucide-react"
import Link from "next/link"

export default function NewBankAccountPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [form, setForm] = useState({
    name: "",
    bankName: "",
    accountNumber: "",
    iban: "",
    openingBalance: "0",
    accountId: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/accounts?type=BANK,CASH")
      .then((r) => r.json())
      .then((d) => setAccounts(Array.isArray(d) ? d : []))
      .catch(console.error)
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await fetch("/api/banking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      router.push("/dashboard/banking")
    } else {
      setError(data.error || "حدث خطأ")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/banking">
            <ArrowRight className="h-4 w-4 ml-1" /> الحسابات البنكية
          </Link>
        </Button>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold">إضافة حساب بنكي</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">معلومات الحساب</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>اسم الحساب *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="الراجحي - الحساب الرئيسي" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>اسم البنك</Label>
              <Input value={form.bankName} onChange={set("bankName")} placeholder="بنك الراجحي" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الحساب</Label>
              <Input value={form.accountNumber} onChange={set("accountNumber")} placeholder="1234567890" dir="ltr" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>رقم IBAN</Label>
            <Input value={form.iban} onChange={set("iban")} placeholder="SA0380000000608010167519" dir="ltr" maxLength={34} />
          </div>
          <div className="space-y-1.5">
            <Label>الرصيد الافتتاحي</Label>
            <Input type="number" value={form.openingBalance} onChange={set("openingBalance")} min="0" step="0.01" dir="ltr" />
          </div>
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label>الحساب المحاسبي</Label>
              <select
                value={form.accountId}
                onChange={set("accountId")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">الافتراضي (حساب بنك أول)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400">اختر الحساب المحاسبي المرتبط بهذا البنك</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          إضافة الحساب
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/banking">إلغاء</Link>
        </Button>
      </div>
    </form>
  )
}

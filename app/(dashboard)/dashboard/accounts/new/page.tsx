"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function NewAccountPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<any[]>([])
  const [form, setForm] = useState({
    code: "",
    name: "",
    groupId: "",
    accountType: "ASSET",
    description: "",
    openingBalance: "0",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/accounts/groups").then((r) => r.json()).then(setGroups)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "حدث خطأ")
      setLoading(false)
    } else {
      router.push("/dashboard/accounts")
    }
  }

  const accountTypes = [
    { value: "ASSET", label: "أصول" },
    { value: "LIABILITY", label: "خصوم" },
    { value: "EQUITY", label: "حقوق ملكية" },
    { value: "REVENUE", label: "إيرادات" },
    { value: "EXPENSE", label: "مصروفات" },
    { value: "BANK", label: "بنك" },
    { value: "CASH", label: "صندوق" },
    { value: "ACCOUNTS_RECEIVABLE", label: "ذمم مدينة" },
    { value: "ACCOUNTS_PAYABLE", label: "ذمم دائنة" },
    { value: "STOCK", label: "مخزون" },
    { value: "FIXED_ASSET", label: "أصول ثابتة" },
    { value: "TAX", label: "ضرائب" },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/accounts"><ArrowRight className="h-4 w-4" /> دليل الحسابات</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إضافة حساب جديد</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>كود الحساب</Label>
                <Input value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} placeholder="1010" required />
              </div>
              <div className="space-y-2">
                <Label>نوع الحساب</Label>
                <Select value={form.accountType} onValueChange={(v) => setForm({...form, accountType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>اسم الحساب</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="الصندوق" required />
            </div>

            <div className="space-y-2">
              <Label>المجموعة</Label>
              <Select value={form.groupId} onValueChange={(v) => setForm({...form, groupId: v})}>
                <SelectTrigger><SelectValue placeholder="اختر المجموعة" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الرصيد الافتتاحي</Label>
              <Input type="number" value={form.openingBalance} onChange={(e) => setForm({...form, openingBalance: e.target.value})} />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              حفظ الحساب
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}

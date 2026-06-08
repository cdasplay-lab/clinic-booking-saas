"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, User } from "lucide-react"
import Link from "next/link"

export default function NewEmployeePage() {
  const router = useRouter()
  const today = new Date().toISOString().split("T")[0]

  const [form, setForm] = useState({
    name: "",
    employeeId: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    basicSalary: "",
    joinDate: today,
    commissionRate: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await fetch("/api/payroll/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, basicSalary: Number(form.basicSalary) }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push("/dashboard/payroll")
    } else {
      setError(data.error || "حدث خطأ")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/payroll">
            <ArrowRight className="h-4 w-4 ml-1" /> الرواتب
          </Link>
        </Button>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold">موظف جديد</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">المعلومات الشخصية</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الاسم الكامل *</Label>
              <Input value={form.name} onChange={set("name")} required placeholder="أحمد محمد علي" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الموظف</Label>
              <Input value={form.employeeId} onChange={set("employeeId")} placeholder="تلقائي" dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="ahmed@company.com" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الهاتف</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="+9665xxxxxxxx" dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>القسم</Label>
              <Input value={form.department} onChange={set("department")} placeholder="المحاسبة" />
            </div>
            <div className="space-y-1.5">
              <Label>المسمى الوظيفي</Label>
              <Input value={form.position} onChange={set("position")} placeholder="محاسب أول" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">الراتب والتوظيف</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الراتب الأساسي الشهري *</Label>
              <Input type="number" min="0" step="0.01" value={form.basicSalary} onChange={set("basicSalary")} required dir="ltr" placeholder="5000" />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الالتحاق *</Label>
              <Input type="date" value={form.joinDate} onChange={set("joinDate")} required dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>نسبة العمولة % <span className="text-gray-400 font-normal">(اختياري)</span></Label>
              <Input type="number" min="0" max="100" step="0.01" value={form.commissionRate} onChange={set("commissionRate")} dir="ltr" placeholder="2.5" />
              <p className="text-xs text-gray-400">إذا أُدخلت، تُحسب العمولة تلقائياً عند إنشاء فاتورة لهذا المندوب</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          إضافة الموظف
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/payroll">إلغاء</Link>
        </Button>
      </div>
    </form>
  )
}

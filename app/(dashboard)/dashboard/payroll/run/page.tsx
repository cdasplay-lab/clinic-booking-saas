"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, Calculator, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface Employee {
  id: string
  employeeId: string
  name: string
  basicSalary: number
  department: string | null
  position: string | null
}

export default function PayrollRunPage() {
  const router = useRouter()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]

  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({
    period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    startDate: monthStart,
    endDate: monthEnd,
    payDate: monthEnd,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/payroll/employees")
      .then((r) => r.json())
      .then((d) => {
        const active = (Array.isArray(d) ? d : []).filter((e: any) => e.isActive)
        setEmployees(active)
        setSelected(new Set(active.map((e: any) => e.id)))
      })
      .catch(console.error)
  }, [])

  function toggleAll() {
    if (selected.size === employees.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(employees.map((e) => e.id)))
    }
  }

  const selectedEmployees = employees.filter((e) => selected.has(e.id))
  const totalGross = selectedEmployees.reduce((s, e) => s + Number(e.basicSalary), 0)

  async function handleRun(e: React.FormEvent) {
    e.preventDefault()
    if (selected.size === 0) { setError("يجب تحديد موظف على الأقل"); return }
    setLoading(true)
    setError("")
    const res = await fetch("/api/payroll/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, employeeIds: Array.from(selected) }),
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
    <form onSubmit={handleRun} className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/payroll">
            <ArrowRight className="h-4 w-4 ml-1" /> الرواتب
          </Link>
        </Button>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold">تشغيل كشف الرواتب</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">فترة الرواتب</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الفترة (YYYY-MM)</Label>
              <Input value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder="2025-01" dir="ltr" required />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الصرف</Label>
              <Input type="date" value={form.payDate} onChange={(e) => setForm((f) => ({ ...f, payDate: e.target.value }))} dir="ltr" required />
            </div>
            <div className="space-y-1.5">
              <Label>بداية الفترة</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} dir="ltr" required />
            </div>
            <div className="space-y-1.5">
              <Label>نهاية الفترة</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} dir="ltr" required />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">الموظفون ({selected.size} محدد)</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
              {selected.size === employees.length ? "إلغاء الكل" : "تحديد الكل"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              لا يوجد موظفون — <Link href="/dashboard/payroll/employees/new" className="text-blue-600 hover:underline">أضف موظفاً</Link>
            </div>
          ) : (
            <div className="divide-y">
              {employees.map((emp) => (
                <label key={emp.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(emp.id)}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(emp.id)) next.delete(emp.id)
                          else next.add(emp.id)
                          return next
                        })
                      }}
                      className="rounded"
                    />
                    <div>
                      <p className="font-medium text-sm">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.employeeId} {emp.position ? `— ${emp.position}` : ""}</p>
                    </div>
                  </div>
                  <p className="font-medium text-sm text-blue-700">{formatCurrency(Number(emp.basicSalary))}</p>
                </label>
              ))}
            </div>
          )}
          {selected.size > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-t">
              <p className="text-sm font-medium text-blue-800">إجمالي الرواتب ({selected.size} موظف)</p>
              <p className="text-base font-bold text-blue-700">{formatCurrency(totalGross)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading || selected.size === 0}>
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري المعالجة...</>
          ) : (
            <><CheckCircle2 className="h-4 w-4 ml-2" />تشغيل كشف الرواتب</>
          )}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/payroll">إلغاء</Link>
        </Button>
      </div>
    </form>
  )
}

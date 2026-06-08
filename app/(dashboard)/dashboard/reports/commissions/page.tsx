"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowRight, CheckCircle2, Clock, DollarSign } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type Commission = {
  id: string; invoiceTotal: number; rate: number; amount: number
  status: "PENDING" | "PAID"; paidAt: string | null; createdAt: string
  employee: { name: string; employeeId: string }
  invoice: { number: string; date: string; contact: { name: string } }
}
type Employee = { id: string; name: string; employeeId: string }

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterEmp, setFilterEmp] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [paying, setPaying]       = useState(false)

  function load() {
    const q = new URLSearchParams()
    if (filterEmp) q.set("employeeId", filterEmp)
    if (filterStatus) q.set("status", filterStatus)
    fetch(`/api/commissions?${q}`).then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setCommissions(d)
      setLoading(false)
    })
  }
  useEffect(() => {
    fetch("/api/payroll/employees").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setEmployees(d) })
  }, [])
  useEffect(() => { setLoading(true); load() }, [filterEmp, filterStatus])

  async function markPaid() {
    if (selected.size === 0) return
    setPaying(true)
    const res = await fetch("/api/commissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    })
    if (res.ok) { setSelected(new Set()); load() }
    setPaying(false)
  }

  const pendingTotal   = commissions.filter((c) => c.status === "PENDING").reduce((s, c) => s + Number(c.amount), 0)
  const selectedTotal  = commissions.filter((c) => selected.has(c.id)).reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/reports"><ArrowRight className="h-4 w-4" /> التقارير</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">عمولات المندوبين</h1>
        <p className="text-sm text-gray-500">متابعة ودفع عمولات المبيعات</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <Clock className="h-8 w-8 text-amber-500" />
          <div>
            <p className="text-xs text-gray-500">عمولات مستحقة</p>
            <p className="text-lg font-bold">{formatCurrency(pendingTotal)}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-green-500" />
          <div>
            <p className="text-xs text-gray-500">المحدد للدفع</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(selectedTotal)}</p>
          </div>
        </CardContent></Card>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <Select value={filterEmp} onValueChange={setFilterEmp}>
          <SelectTrigger className="w-48"><SelectValue placeholder="كل المندوبين" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">كل المندوبين</SelectItem>
            {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">كل الحالات</SelectItem>
            <SelectItem value="PENDING">مستحقة</SelectItem>
            <SelectItem value="PAID">مدفوعة</SelectItem>
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <Button size="sm" onClick={markPaid} disabled={paying} className="bg-green-600 hover:bg-green-700 mr-auto">
            {paying ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
            تسديد {selected.size} عمولة ({formatCurrency(selectedTotal)})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : commissions.length === 0 ? (
        <p className="text-center text-gray-400 py-10">لا توجد عمولات</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-4 py-2">
                    <input type="checkbox"
                      checked={commissions.filter((c) => c.status === "PENDING").every((c) => selected.has(c.id)) && commissions.some((c) => c.status === "PENDING")}
                      onChange={(e) => {
                        const pending = commissions.filter((c) => c.status === "PENDING").map((c) => c.id)
                        setSelected(e.target.checked ? new Set(pending) : new Set())
                      }}
                    />
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">المندوب</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">الفاتورة</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">العميل</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">النسبة</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">العمولة</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-600">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {commissions.map((c) => (
                  <tr key={c.id} className={c.status === "PAID" ? "bg-gray-50 opacity-60" : ""}>
                    <td className="px-4 py-2.5">
                      {c.status === "PENDING" && (
                        <input type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={(e) => {
                            const s = new Set(selected)
                            e.target.checked ? s.add(c.id) : s.delete(c.id)
                            setSelected(s)
                          }}
                        />
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{c.employee.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {c.invoice.number}
                      <span className="text-gray-400 mr-1">{new Date(c.invoice.date).toLocaleDateString("ar-AE")}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{c.invoice.contact.name}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{Number(c.rate)}%</td>
                    <td className="px-4 py-2.5 text-left font-bold">{formatCurrency(Number(c.amount))}</td>
                    <td className="px-4 py-2.5 text-center">
                      {c.status === "PAID"
                        ? <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 ml-1" />مدفوعة</Badge>
                        : <Badge variant="outline" className="border-amber-400 text-amber-700">مستحقة</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { ArrowRight, Loader2, BarChart3 } from "lucide-react"

type ReportData = {
  date: string
  totalSales: number
  totalCash: number
  totalCard: number
  totalTxCount: number
  sessions: { id: string; number: string; cashier: string; openedAt: string; closedAt: string | null; status: string; totalSales: number; txCount: number }[]
  topProducts: { name: string; code: string; qty: number; total: number }[]
}

export default function PosReportPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]       = useState(today)
  const [data, setData]       = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pos/report?date=${date}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [date])

  const fmtTime = (s: string) => new Date(s).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/pos"><ArrowRight className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">تقرير يومي — نقطة البيع</h1>
          </div>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center pt-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "إجمالي المبيعات",  value: formatCurrency(data.totalSales),    color: "text-blue-600" },
              { label: "نقداً",             value: formatCurrency(data.totalCash),     color: "text-green-600" },
              { label: "بطاقة/شبكة",       value: formatCurrency(data.totalCard),     color: "text-purple-600" },
              { label: "عدد الفواتير",      value: data.totalTxCount.toString(),       color: "text-gray-700" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border p-4">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Sessions */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b"><h2 className="font-semibold">الورديات</h2></div>
            {data.sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">لا توجد ورديات لهذا اليوم</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوردية</TableHead>
                    <TableHead>الكاشير</TableHead>
                    <TableHead>فتح</TableHead>
                    <TableHead>إغلاق</TableHead>
                    <TableHead className="text-left">المبيعات</TableHead>
                    <TableHead className="text-left">الفواتير</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm font-medium">{s.number}</TableCell>
                      <TableCell>{s.cashier}</TableCell>
                      <TableCell className="text-gray-500 text-sm">{fmtTime(s.openedAt)}</TableCell>
                      <TableCell className="text-gray-500 text-sm">{s.closedAt ? fmtTime(s.closedAt) : "—"}</TableCell>
                      <TableCell className="text-left font-medium text-blue-600">{formatCurrency(Number(s.totalSales))}</TableCell>
                      <TableCell className="text-left">{s.txCount}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "OPEN" ? "success" : "secondary"}>
                          {s.status === "OPEN" ? "مفتوحة" : "مغلقة"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Top products */}
          {data.topProducts.length > 0 && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 border-b"><h2 className="font-semibold">أكثر المنتجات مبيعاً</h2></div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>المنتج</TableHead>
                    <TableHead className="text-left">الكمية المباعة</TableHead>
                    <TableHead className="text-left">الإيراد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProducts.map((p, idx) => (
                    <TableRow key={p.code}>
                      <TableCell className="text-gray-400 text-sm">{idx + 1}</TableCell>
                      <TableCell>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                      </TableCell>
                      <TableCell className="text-left font-medium">{p.qty.toLocaleString("ar-SA")}</TableCell>
                      <TableCell className="text-left font-bold text-blue-600">{formatCurrency(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

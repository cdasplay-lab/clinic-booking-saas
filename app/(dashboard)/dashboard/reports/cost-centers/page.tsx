"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Layers, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react"
import Link from "next/link"

interface CostCenterRow {
  id:          string
  code:        string
  name:        string
  parentName:  string | null
  isActive:    boolean
  totalDebit:  number
  totalCredit: number
  expenses:    number
  revenue:     number
  netProfit:   number
}

export default function CostCenterReportPage() {
  const now  = new Date()
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`)
  const [to,   setTo]   = useState(now.toISOString().split("T")[0])
  const [data, setData] = useState<{ rows: CostCenterRow[]; currency: string; totals: any } | null>(null)
  const [loading, setLoading] = useState(false)

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true)
    const res = await fetch(`/api/reports/cost-centers?from=${f}&to=${t}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load(from, to) }, [])

  const currency = data?.currency || "SAR"

  return (
    <div className="space-y-4 max-w-5xl" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/cost-centers"><ArrowRight className="h-4 w-4 ml-1" /> مراكز التكلفة</Link>
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-600" />
          تقرير مراكز التكلفة
        </h1>
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="pt-4 pb-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500 font-medium">الفترة:</span>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-38 h-8 text-sm" />
            <span className="text-gray-400">—</span>
            <Input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="w-38 h-8 text-sm" />
          </div>
          <Button size="sm" onClick={() => load(from, to)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "عرض"}
          </Button>
          <div className="flex gap-1 mr-2">
            {[
              { label: "هذه السنة",  f: `${now.getFullYear()}-01-01`, t: now.toISOString().split("T")[0] },
              { label: "هذا الشهر",  f: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`, t: now.toISOString().split("T")[0] },
              { label: "الربع الأول", f: `${now.getFullYear()}-01-01`, t: `${now.getFullYear()}-03-31` },
            ].map((q) => (
              <Button key={q.label} variant="outline" size="sm" className="h-7 text-xs px-2"
                onClick={() => { setFrom(q.f); setTo(q.t); load(q.f, q.t) }}>
                {q.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500 flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" />إجمالي الإيرادات</p>
            <p className="text-xl font-bold text-green-600 mt-1">{fmt(data.totals.revenue)} {currency}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500 flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-500" />إجمالي المصروفات</p>
            <p className="text-xl font-bold text-red-600 mt-1">{fmt(data.totals.expenses)} {currency}</p>
          </div>
          <div className={`rounded-lg border p-4 ${data.totals.netProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <p className="text-sm text-gray-500 flex items-center gap-1"><Minus className="h-3 w-3" />صافي الربح</p>
            <p className={`text-xl font-bold mt-1 ${data.totals.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
              {fmt(Math.abs(data.totals.netProfit))} {currency}
              {data.totals.netProfit < 0 && " (خسارة)"}
            </p>
          </div>
        </div>
      )}

      {/* Report table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">الأداء المالي لكل مركز</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !data ? null : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-xs">
                  <TableHead>الرمز</TableHead>
                  <TableHead>مركز التكلفة</TableHead>
                  <TableHead>المركز الأب</TableHead>
                  <TableHead className="text-left">الإيرادات</TableHead>
                  <TableHead className="text-left">المصروفات</TableHead>
                  <TableHead className="text-left">صافي الربح</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-gray-400">
                      لا توجد مراكز تكلفة أو لا توجد بيانات للفترة المحددة
                    </TableCell>
                  </TableRow>
                ) : (
                  data.rows.map((row) => (
                    <TableRow key={row.id} className={`text-sm ${!row.isActive ? "opacity-50" : ""}`}>
                      <TableCell className="font-mono text-xs text-gray-500">{row.code}</TableCell>
                      <TableCell className="font-medium">
                        {row.name}
                        {!row.isActive && <Badge className="mr-2 text-xs bg-gray-100 text-gray-500 border-0">غير نشط</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{row.parentName || "—"}</TableCell>
                      <TableCell className="text-left font-mono text-green-700 text-sm">
                        {row.revenue > 0 ? fmt(row.revenue) : <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell className="text-left font-mono text-red-600 text-sm">
                        {row.expenses > 0 ? fmt(row.expenses) : <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell className={`text-left font-mono font-bold text-sm ${row.netProfit > 0 ? "text-green-700" : row.netProfit < 0 ? "text-red-600" : "text-gray-400"}`}>
                        {row.netProfit !== 0 ? (
                          <>
                            {row.netProfit < 0 && "-"}
                            {fmt(Math.abs(row.netProfit))}
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {(row.revenue > 0 || row.expenses > 0) && (
                          <div className="flex items-center gap-1">
                            {row.revenue > 0 && row.expenses > 0 && (
                              <div className="h-1.5 w-20 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${row.netProfit >= 0 ? "bg-green-500" : "bg-red-500"}`}
                                  style={{ width: `${Math.min(100, Math.abs(row.netProfit) / Math.max(row.revenue, row.expenses) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {data.rows.length > 0 && (
                <TableFooter>
                  <TableRow className="font-bold bg-gray-100">
                    <TableCell colSpan={3}>الإجمالي</TableCell>
                    <TableCell className="text-left font-mono text-green-700">{fmt(data.totals.revenue)}</TableCell>
                    <TableCell className="text-left font-mono text-red-600">{fmt(data.totals.expenses)}</TableCell>
                    <TableCell className={`text-left font-mono ${data.totals.netProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {data.totals.netProfit < 0 && "-"}{fmt(Math.abs(data.totals.netProfit))}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

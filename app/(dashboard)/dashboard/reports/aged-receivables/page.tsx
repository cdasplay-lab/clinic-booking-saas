"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Download, ChevronDown, ChevronRight, AlertTriangle, Users } from "lucide-react"
import Link from "next/link"

const BUCKET_COLORS: Record<string, string> = {
  current:     "text-green-700 bg-green-50",
  days1_30:    "text-blue-700 bg-blue-50",
  days31_60:   "text-yellow-700 bg-yellow-50",
  days61_90:   "text-orange-700 bg-orange-50",
  days91_120:  "text-red-600 bg-red-50",
  days120plus: "text-red-800 bg-red-100 font-bold",
}

export default function AgedReceivablesPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split("T")[0])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async (date: string) => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/reports/aged-receivables?asOf=${date}`)
      if (!res.ok) throw new Error("فشل تحميل التقرير")
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(asOf) }, [])

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const fmt = (n: number) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const overdueTotal = data
    ? (data.totals.days1_30 + data.totals.days31_60 + data.totals.days61_90 + data.totals.days91_120 + data.totals.days120plus)
    : 0

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">تقرير الذمم المدينة المتقادمة</h1>
          <p className="text-sm text-gray-500">الفواتير غير المحصّلة مصنّفة حسب عمر الدَّين</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="w-40"
          />
          <Button onClick={() => load(asOf)} disabled={loading} variant="outline">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "تحديث"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/reports/aged-receivables?asOf=${asOf}&export=xlsx`}>
              <Download className="h-4 w-4 ml-1" />Excel
            </a>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-green-200">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500">إجمالي المستحق</p>
              <p className="text-xl font-bold text-gray-900">{fmt(data.totals.total)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{data.currency}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500">متأخر (فوق الاستحقاق)</p>
              <p className="text-xl font-bold text-red-600">{fmt(overdueTotal)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {data.totals.total > 0 ? Math.round((overdueTotal / data.totals.total) * 100) : 0}% من الإجمالي
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500">عدد العملاء</p>
              <p className="text-xl font-bold">{data.rows.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">لديهم مستحقات</p>
            </CardContent>
          </Card>
          <Card className="border-red-300">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500">أكثر من 120 يوم</p>
              <p className="text-xl font-bold text-red-800">{fmt(data.totals.days120plus)}</p>
              <p className="text-xs text-red-500 mt-0.5">يحتاج متابعة عاجلة</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-blue-600" />
            تفصيل حسب العميل
            {data && <Badge variant="outline">{data.rows.length} عميل</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !data || data.rows.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>لا توجد ذمم مدينة مستحقة بهذا التاريخ</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 text-xs">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>العميل</TableHead>
                    {data.buckets.map((b: any) => (
                      <TableHead key={b.key} className="text-left whitespace-nowrap text-xs">{b.label}</TableHead>
                    ))}
                    <TableHead className="text-left font-bold">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row: any) => (
                    <>
                      <TableRow
                        key={row.contact.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleRow(row.contact.id)}
                      >
                        <TableCell className="w-8 text-gray-400">
                          {expanded.has(row.contact.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{row.contact.name}</p>
                          {row.contact.phone && <p className="text-xs text-gray-400">{row.contact.phone}</p>}
                        </TableCell>
                        {data.buckets.map((b: any) => (
                          <TableCell key={b.key} className="text-left">
                            {row[b.key] > 0 ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${BUCKET_COLORS[b.key]}`}>
                                {fmt(row[b.key])}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-left font-bold">{fmt(row.total)}</TableCell>
                      </TableRow>

                      {/* Expanded invoice detail */}
                      {expanded.has(row.contact.id) && row.invoices.map((inv: any) => (
                        <TableRow key={inv.id} className="bg-blue-50/40 text-sm">
                          <TableCell></TableCell>
                          <TableCell className="pr-6">
                            <Link href={`/dashboard/invoices/${inv.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                              {inv.number}
                            </Link>
                            <span className="text-gray-400 text-xs mr-2">
                              استحقاق: {new Date(inv.dueDate).toLocaleDateString("ar-SA")}
                            </span>
                          </TableCell>
                          {data.buckets.map((b: any) => (
                            <TableCell key={b.key} className="text-left">
                              {getBucketKey(inv.daysOverdue) === b.key ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${BUCKET_COLORS[b.key]}`}>
                                  {fmt(inv.amount)}
                                </span>
                              ) : null}
                            </TableCell>
                          ))}
                          <TableCell className="text-left text-xs text-gray-500">
                            {inv.daysOverdue > 0 ? (
                              <span className="text-red-600">{inv.daysOverdue} يوم متأخر</span>
                            ) : (
                              <span className="text-green-600">لم يستحق بعد</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}

                  {/* Totals row */}
                  <TableRow className="bg-gray-100 font-bold border-t-2">
                    <TableCell></TableCell>
                    <TableCell>الإجمالي</TableCell>
                    {data.buckets.map((b: any) => (
                      <TableCell key={b.key} className="text-left">
                        {data.totals[b.key] > 0 ? fmt(data.totals[b.key]) : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-left text-blue-700">{fmt(data.totals.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getBucketKey(daysOverdue: number): string {
  if (daysOverdue <= 0)   return "current"
  if (daysOverdue <= 30)  return "days1_30"
  if (daysOverdue <= 60)  return "days31_60"
  if (daysOverdue <= 90)  return "days61_90"
  if (daysOverdue <= 120) return "days91_120"
  return "days120plus"
}

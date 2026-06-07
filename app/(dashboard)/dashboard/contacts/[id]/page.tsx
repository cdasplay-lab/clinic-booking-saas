"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Download, Printer, ArrowRight, User, Phone, Mail, FileText } from "lucide-react"
import Link from "next/link"

const TXN_CONFIG: Record<string, { label: string; color: string }> = {
  INVOICE:     { label: "فاتورة",        color: "bg-blue-100 text-blue-700" },
  CREDIT_NOTE: { label: "إشعار خصم",    color: "bg-orange-100 text-orange-700" },
  PAYMENT:     { label: "دفعة مستلمة",  color: "bg-green-100 text-green-700" },
  BILL:        { label: "فاتورة مورد",  color: "bg-purple-100 text-purple-700" },
  DEBIT_NOTE:  { label: "إشعار إضافة",  color: "bg-pink-100 text-pink-700" },
  PAYMENT_OUT: { label: "دفعة مدفوعة", color: "bg-red-100 text-red-700" },
}

const TXN_HREF: Record<string, (id: string) => string> = {
  INVOICE:     (id) => `/dashboard/invoices/${id}`,
  CREDIT_NOTE: (id) => `/dashboard/credit-notes/${id}`,
  PAYMENT:     (id) => `/dashboard/payments`,
  BILL:        (id) => `/dashboard/bills/${id}`,
  DEBIT_NOTE:  (id) => `/dashboard/debit-notes/${id}`,
  PAYMENT_OUT: (id) => `/dashboard/payments`,
}

export default function ContactStatementPage() {
  const { id } = useParams<{ id: string }>()

  const now = new Date()
  const [from, setFrom] = useState(new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0])
  const [to, setTo]     = useState(now.toISOString().split("T")[0])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/contacts/${id}/statement?from=${f}&to=${t}`)
      if (!res.ok) throw new Error("فشل تحميل الكشف")
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load(from, to) }, [])

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-5 max-w-5xl" dir="rtl">
      {/* Back + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/contacts/customers"><ArrowRight className="h-4 w-4 ml-1" />العملاء</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/print/statement/${id}?from=${from}&to=${to}`} target="_blank">
              <Printer className="h-4 w-4 ml-1" />طباعة
            </a>
          </Button>
        </div>
      </div>

      {/* Contact info */}
      {data?.contact && (
        <div className="flex items-start gap-4 p-4 bg-white border rounded-xl">
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{data.contact.name}</h1>
            <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
              {data.contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{data.contact.phone}</span>}
              {data.contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{data.contact.email}</span>}
              {data.contact.taxNumber && <span>الرقم الضريبي: {data.contact.taxNumber}</span>}
            </div>
          </div>
          <div className="text-left">
            {data.closingBalance !== undefined && (
              <div className={`text-2xl font-bold ${data.closingBalance > 0 ? "text-red-600" : data.closingBalance < 0 ? "text-green-600" : "text-gray-400"}`}>
                {fmt(Math.abs(data.closingBalance))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {data.closingBalance > 0 ? "مستحق عليه" : data.closingBalance < 0 ? "رصيد لصالحه" : "لا يوجد رصيد"}
            </p>
          </div>
        </div>
      )}

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
          {/* Quick periods */}
          <div className="flex gap-1 mr-2">
            {[
              { label: "هذه السنة",  f: `${now.getFullYear()}-01-01`, t: now.toISOString().split("T")[0] },
              { label: "هذا الشهر",  f: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`, t: now.toISOString().split("T")[0] },
              { label: "آخر 90 يوم", f: new Date(now.getTime()-90*86400000).toISOString().split("T")[0], t: now.toISOString().split("T")[0] },
            ].map((q) => (
              <Button key={q.label} variant="outline" size="sm" className="h-7 text-xs px-2"
                onClick={() => { setFrom(q.f); setTo(q.t); load(q.f, q.t) }}>
                {q.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Statement table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-blue-600" />
            كشف الحساب
            {data && (
              <span className="text-sm font-normal text-gray-500">
                ({data.transactions.length} حركة)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !data ? null : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-xs">
                  <TableHead>التاريخ</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الرقم / المرجع</TableHead>
                  <TableHead>البيان</TableHead>
                  <TableHead className="text-left">مدين</TableHead>
                  <TableHead className="text-left">دائن</TableHead>
                  <TableHead className="text-left">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening balance row */}
                <TableRow className="bg-gray-50 font-medium text-sm">
                  <TableCell colSpan={4}>
                    رصيد أول المدة ({new Date(data.period.from).toLocaleDateString("ar-SA")})
                  </TableCell>
                  <TableCell className="text-left"></TableCell>
                  <TableCell className="text-left"></TableCell>
                  <TableCell className={`text-left font-bold ${data.openingBalance > 0 ? "text-red-600" : data.openingBalance < 0 ? "text-green-600" : ""}`}>
                    {data.openingBalance !== 0 ? fmt(Math.abs(data.openingBalance)) : "—"}
                    {data.openingBalance !== 0 && (
                      <span className="text-xs mr-1 text-gray-400">{data.openingBalance > 0 ? "مدين" : "دائن"}</span>
                    )}
                  </TableCell>
                </TableRow>

                {data.transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-gray-400">
                      لا توجد حركات في هذه الفترة
                    </TableCell>
                  </TableRow>
                )}

                {data.transactions.map((txn: any) => {
                  const cfg = TXN_CONFIG[txn.type] || { label: txn.type, color: "bg-gray-100 text-gray-600" }
                  const href = TXN_HREF[txn.type]?.(txn.id)
                  return (
                    <TableRow key={txn.id + txn.date} className="text-sm hover:bg-gray-50">
                      <TableCell className="whitespace-nowrap">
                        {new Date(txn.date).toLocaleDateString("ar-SA")}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${cfg.color} border-0`}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {href ? (
                          <Link href={href} className="font-mono text-blue-600 hover:underline text-xs">
                            {txn.number}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs">{txn.number}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">{txn.description}</TableCell>
                      <TableCell className="text-left font-mono text-sm">
                        {txn.debit > 0 ? fmt(txn.debit) : ""}
                      </TableCell>
                      <TableCell className="text-left font-mono text-sm text-green-700">
                        {txn.credit > 0 ? fmt(txn.credit) : ""}
                      </TableCell>
                      <TableCell className={`text-left font-mono text-sm font-medium ${txn.balance > 0 ? "text-red-600" : txn.balance < 0 ? "text-green-600" : "text-gray-400"}`}>
                        {txn.balance !== 0 ? fmt(Math.abs(txn.balance)) : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}

                {/* Totals + closing balance */}
                {data.transactions.length > 0 && (
                  <>
                    <TableRow className="bg-gray-100 font-semibold text-sm border-t-2">
                      <TableCell colSpan={4}>إجمالي الفترة</TableCell>
                      <TableCell className="text-left font-mono">{fmt(data.totalDebit)}</TableCell>
                      <TableCell className="text-left font-mono text-green-700">{fmt(data.totalCredit)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow className="bg-blue-50 font-bold">
                      <TableCell colSpan={4}>رصيد آخر المدة ({new Date(data.period.to).toLocaleDateString("ar-SA")})</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className={`text-left text-base ${data.closingBalance > 0 ? "text-red-600" : data.closingBalance < 0 ? "text-green-600" : "text-gray-500"}`}>
                        {fmt(Math.abs(data.closingBalance))}
                        <span className="text-xs mr-1 font-normal text-gray-500">
                          {data.closingBalance > 0 ? "مدين" : data.closingBalance < 0 ? "دائن" : ""}
                        </span>
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

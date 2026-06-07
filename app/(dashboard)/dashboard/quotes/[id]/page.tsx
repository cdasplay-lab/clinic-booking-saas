"use client"
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Loader2, ArrowRight, FileCheck2, Send, XCircle, RefreshCw } from "lucide-react"
import Link from "next/link"

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: "مسودة",         color: "bg-gray-100 text-gray-700" },
  SENT:      { label: "مرسل",          color: "bg-blue-100 text-blue-700" },
  ACCEPTED:  { label: "مقبول",         color: "bg-green-100 text-green-700" },
  CONVERTED: { label: "محوّل لفاتورة", color: "bg-purple-100 text-purple-700" },
  CANCELLED: { label: "ملغى",          color: "bg-red-100 text-red-700" },
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [quote, setQuote]       = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [converting, setConverting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError]       = useState("")

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  useEffect(() => {
    fetch(`/api/quotes/${id}`)
      .then((r) => r.json())
      .then((d) => { setQuote(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function updateStatus(status: string) {
    setUpdating(true)
    setError("")
    const res = await fetch(`/api/quotes/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || "فشل التحديث")
    else setQuote((q: any) => ({ ...q, status }))
    setUpdating(false)
  }

  async function convertToInvoice() {
    if (!confirm("تحويل عرض السعر إلى فاتورة؟ لا يمكن التراجع عن هذه العملية.")) return
    setConverting(true)
    setError("")
    const res = await fetch(`/api/quotes/${id}/convert`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "فشل التحويل"); setConverting(false) }
    else router.push(`/dashboard/invoices/${data.invoiceId}`)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  if (!quote)  return <div className="text-center py-20 text-gray-500">عرض السعر غير موجود</div>

  const status   = statusConfig[quote.status] || statusConfig.DRAFT
  const isExpired = new Date(quote.dueDate) < new Date() && ["DRAFT", "SENT"].includes(quote.status)
  const canAct   = !["CONVERTED", "CANCELLED"].includes(quote.status)

  return (
    <div className="max-w-4xl mx-auto space-y-4" dir="rtl">
      {/* Back + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/quotes"><ArrowRight className="h-4 w-4 ml-1" /> عروض الأسعار</Link>
        </Button>
        <div className="flex gap-2 flex-wrap">
          {quote.status === "DRAFT" && (
            <Button size="sm" variant="outline" onClick={() => updateStatus("SENT")} disabled={updating}>
              <Send className="h-4 w-4 ml-1" /> تعيين كمرسل
            </Button>
          )}
          {["DRAFT", "SENT"].includes(quote.status) && (
            <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => updateStatus("ACCEPTED")} disabled={updating}>
              <FileCheck2 className="h-4 w-4 ml-1" /> قبول العرض
            </Button>
          )}
          {canAct && (
            <>
              <Button size="sm" variant="default"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={convertToInvoice} disabled={converting || updating}>
                {converting
                  ? <Loader2 className="h-4 w-4 animate-spin ml-1" />
                  : <RefreshCw className="h-4 w-4 ml-1" />}
                تحويل إلى فاتورة
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => updateStatus("CANCELLED")} disabled={updating}>
                <XCircle className="h-4 w-4 ml-1" /> إلغاء العرض
              </Button>
            </>
          )}
          {quote.convertedInvoiceId && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/dashboard/invoices/${quote.convertedInvoiceId}`}>عرض الفاتورة ←</Link>
            </Button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <Card className="overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-indigo-200 text-sm">عرض سعر لـ</p>
              <p className="text-2xl font-bold mt-1">{quote.contact?.name}</p>
              {quote.contact?.phone && <p className="text-indigo-200 text-sm mt-1">{quote.contact.phone}</p>}
            </div>
            <div className="text-left">
              <p className="text-3xl font-bold">عرض سعر</p>
              <p className="font-mono text-indigo-200 text-lg">{quote.number}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                {isExpired ? "منتهي الصلاحية" : status.label}
              </span>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs">تاريخ العرض</p>
              <p className="font-medium mt-1">{new Date(quote.date).toLocaleDateString("ar-SA")}</p>
            </div>
            <div className={`rounded-lg p-3 ${isExpired ? "bg-red-50" : "bg-gray-50"}`}>
              <p className={`text-xs ${isExpired ? "text-red-500" : "text-gray-500"}`}>صالح حتى</p>
              <p className={`font-medium mt-1 ${isExpired ? "text-red-600" : ""}`}>
                {new Date(quote.dueDate).toLocaleDateString("ar-SA")}
                {isExpired && " — منتهي"}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>#</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead className="text-left">الكمية</TableHead>
                  <TableHead className="text-left">سعر الوحدة</TableHead>
                  <TableHead className="text-left">الضريبة</TableHead>
                  <TableHead className="text-left">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items?.map((item: any, i: number) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-gray-400 text-sm">{i + 1}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-left">{Number(item.quantity).toFixed(2)}</TableCell>
                    <TableCell className="text-left">{fmt(Number(item.unitPrice))}</TableCell>
                    <TableCell className="text-left text-sm text-gray-500">
                      {item.taxRate ? `${Number(item.taxRate.rate)}%` : "-"}
                    </TableCell>
                    <TableCell className="text-left font-medium">{fmt(Number(item.total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-left font-medium">المجموع الفرعي</TableCell>
                  <TableCell className="text-left">{fmt(Number(quote.subtotal))}</TableCell>
                </TableRow>
                {Number(quote.taxAmount) > 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-left font-medium text-orange-700">الضريبة</TableCell>
                    <TableCell className="text-left text-orange-700">{fmt(Number(quote.taxAmount))}</TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-indigo-50">
                  <TableCell colSpan={5} className="text-left font-bold text-lg">الإجمالي</TableCell>
                  <TableCell className="text-left font-bold text-lg text-indigo-700">{fmt(Number(quote.total))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">ملاحظات:</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{quote.notes}</p>
            </div>
          )}
          {quote.terms && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">الشروط والأحكام:</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{quote.terms}</p>
            </div>
          )}

          {/* Convert CTA */}
          {canAct && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-indigo-800">جاهز للتحويل؟</p>
                <p className="text-sm text-indigo-600 mt-0.5">
                  يمكنك تحويل هذا العرض إلى فاتورة مبيعات بنقرة واحدة
                </p>
              </div>
              <Button onClick={convertToInvoice} disabled={converting || updating}
                className="bg-indigo-600 hover:bg-indigo-700">
                {converting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
                تحويل إلى فاتورة
              </Button>
            </div>
          )}

          {/* Converted notice */}
          {quote.status === "CONVERTED" && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
              <p className="text-purple-700 font-medium">تم تحويل هذا العرض إلى فاتورة</p>
              {quote.convertedInvoiceId && (
                <Button variant="outline" size="sm" className="border-purple-300 text-purple-700" asChild>
                  <Link href={`/dashboard/invoices/${quote.convertedInvoiceId}`}>عرض الفاتورة</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

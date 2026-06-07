"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ArrowRight, FileX2, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function NewCreditNotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get("invoiceId")

  const [invoice, setInvoice] = useState<any>(null)
  const [loadingInvoice, setLoadingInvoice] = useState(true)

  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [reason, setReason] = useState("")
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!invoiceId) { setLoadingInvoice(false); return }
    fetch(`/api/invoices/${invoiceId}`)
      .then((r) => r.json())
      .then((inv) => {
        setInvoice(inv)
        setItems(inv.items?.map((item: any) => ({
          description: item.description,
          quantity:    String(item.quantity),
          unitPrice:   String(item.unitPrice),
          taxRateId:   item.taxRateId || "",
          taxAmount:   Number(item.taxAmount),
          total:       Number(item.total),
        })) || [])
      })
      .catch(() => setError("تعذّر تحميل الفاتورة"))
      .finally(() => setLoadingInvoice(false))
  }, [invoiceId])

  function updateItem(index: number, field: string, value: string) {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    const qty   = parseFloat(updated[index].quantity)  || 0
    const price = parseFloat(updated[index].unitPrice) || 0
    const sub   = qty * price
    const tax   = Math.round(sub * (updated[index].taxRate ? Number(updated[index].taxRate) / 100 : 0) * 100) / 100
    updated[index].taxAmount = tax
    updated[index].total     = Math.round((sub + tax) * 100) / 100
    setItems(updated)
  }

  const subtotal  = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0)
  const taxTotal  = items.reduce((s, i) => s + i.taxAmount, 0)
  const total     = Math.round((subtotal + taxTotal) * 100) / 100

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invoiceId) { setError("لا توجد فاتورة مرتبطة"); return }
    if (items.length === 0) { setError("أضف بنداً واحداً على الأقل"); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditedInvoiceId: invoiceId, reason, date, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/dashboard/credit-notes/${data.id}`)
    } catch (err: any) {
      setError(err.message || "حدث خطأ")
      setLoading(false)
    }
  }

  if (loadingInvoice) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  }

  if (!invoiceId || (!invoice && !loadingInvoice)) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <p className="font-medium">يجب اختيار فاتورة أصلية</p>
        <Button asChild variant="outline"><Link href="/dashboard/invoices">اختر فاتورة</Link></Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/invoices/${invoiceId}`}><ArrowRight className="h-4 w-4" /> العودة للفاتورة</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileX2 className="h-6 w-6 text-orange-500" />
          إشعار خصم جديد
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          بخصوص الفاتورة: <span className="font-mono font-medium text-blue-600">{invoice?.number}</span>
          {" · "}{invoice?.contact?.name}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <Card>
          <CardContent className="pt-5 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>تاريخ الإشعار</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>سبب الإشعار</Label>
              <Input placeholder="مثال: إرجاع بضاعة، خطأ في التسعير..." value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">البنود المراد تخفيضها</CardTitle>
            <p className="text-xs text-gray-500">يمكنك تعديل الكميات أو الأسعار — الإجمالي لن يتجاوز إجمالي الفاتورة الأصلية</p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوصف</TableHead>
                  <TableHead className="w-24">الكمية</TableHead>
                  <TableHead className="w-28">السعر</TableHead>
                  <TableHead className="w-24 text-left">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                        className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", e.target.value)}
                        className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-center"
                        dir="ltr"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                        className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-left"
                        dir="ltr"
                      />
                    </TableCell>
                    <TableCell className="text-left font-medium text-orange-600">
                      {item.total.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">المجموع الفرعي</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            {taxTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">الضريبة</span>
                <span>{taxTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2 text-orange-600">
              <span>إجمالي الإشعار</span>
              <span>({total.toFixed(2)})</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={`/dashboard/invoices/${invoiceId}`}>إلغاء</Link>
          </Button>
          <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <FileX2 className="h-4 w-4 ml-1" />}
            إصدار إشعار الخصم
          </Button>
        </div>
      </form>
    </div>
  )
}

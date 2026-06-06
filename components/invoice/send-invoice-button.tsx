"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Send, Loader2, CheckCircle, X } from "lucide-react"

interface Props {
  invoiceId: string
  contactEmail?: string | null
  status: string
}

export default function SendInvoiceButton({ invoiceId, contactEmail, status }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(contactEmail || "")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  if (!["DRAFT", "SENT", "PARTIAL", "OVERDUE"].includes(status)) return null

  async function send() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, msg: `تم الإرسال إلى ${data.to}` })
        setTimeout(() => { setOpen(false); setResult(null) }, 3000)
      } else {
        setResult({ ok: false, msg: data.error || "فشل الإرسال" })
      }
    } catch {
      setResult({ ok: false, msg: "خطأ في الاتصال" })
    }
    setLoading(false)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" /> إرسال للعميل
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">إرسال الفاتورة بالبريد</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">البريد الإلكتروني للعميل</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {result && (
              <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {result.ok ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <X className="h-4 w-4 flex-shrink-0" />}
                {result.msg}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>إلغاء</Button>
              <Button size="sm" onClick={send} disabled={loading || !email}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                إرسال
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

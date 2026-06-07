"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Building2, CheckCircle2, XCircle, Ban } from "lucide-react"

type Action = "deposit" | "clear" | "bounce" | "cancel"

export default function ChequeActions({
  chequeId,
  status,
  type,
}: {
  chequeId: string
  status: string
  type: "INCOMING" | "OUTGOING"
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<Action | null>(null)
  const [error, setError] = useState("")

  async function run(action: Action) {
    if (action === "bounce" && !confirm("تأكيد ارتداد الشيك؟ سيتم عكس القيد المحاسبي.")) return
    if (action === "cancel" && !confirm("تأكيد إلغاء الشيك؟")) return
    setLoading(action)
    setError("")
    const res = await fetch(`/api/cheques/${chequeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error || "خطأ")
    }
    setLoading(null)
  }

  const isIncoming = type === "INCOMING"
  const canDeposit = isIncoming && status === "PENDING"
  const canClear   = ["PENDING", "DEPOSITED"].includes(status)
  const canBounce  = ["PENDING", "DEPOSITED"].includes(status)
  const canCancel  = ["PENDING", "DEPOSITED"].includes(status)

  if (["CLEARED", "BOUNCED", "CANCELLED"].includes(status)) {
    return (
      <div className="text-sm text-gray-500">
        {status === "CLEARED" && "✅ تم تحصيل/صرف هذا الشيك — لا توجد إجراءات متاحة"}
        {status === "BOUNCED" && "↩️ هذا الشيك مرتجع"}
        {status === "CANCELLED" && "🚫 هذا الشيك ملغى"}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
      <div className="flex flex-wrap gap-2">
        {canDeposit && (
          <Button variant="outline" onClick={() => run("deposit")} disabled={!!loading}>
            {loading === "deposit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            إيداع برسم التحصيل
          </Button>
        )}
        {canClear && (
          <Button onClick={() => run("clear")} disabled={!!loading} className="bg-green-600 hover:bg-green-700">
            {loading === "clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isIncoming ? "تأكيد التحصيل" : "تأكيد الصرف"}
          </Button>
        )}
        {canBounce && (
          <Button variant="outline" onClick={() => run("bounce")} disabled={!!loading} className="text-red-600 border-red-200 hover:bg-red-50">
            {loading === "bounce" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            ارتداد الشيك
          </Button>
        )}
        {canCancel && (
          <Button variant="ghost" onClick={() => run("cancel")} disabled={!!loading} className="text-gray-500">
            {loading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            إلغاء
          </Button>
        )}
      </div>
    </div>
  )
}

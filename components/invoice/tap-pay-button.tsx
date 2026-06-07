"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2, ExternalLink } from "lucide-react"

interface Props {
  invoiceId: string
  amountDue: number
  currency: string
  disabled?: boolean
}

export default function TapPayButton({ invoiceId, amountDue, currency, disabled }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  if (amountDue <= 0 || disabled) return null

  async function handlePay() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/tap/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      })
      const data = await res.json()

      if (res.ok && data.payUrl) {
        window.location.href = data.payUrl
      } else {
        setError(data.error || "فشل إنشاء رابط الدفع")
        setLoading(false)
      }
    } catch {
      setError("خطأ في الاتصال")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <Button
        onClick={handlePay}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white"
        size="sm"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        ادفع الآن ({amountDue.toFixed(2)} {currency})
        {!loading && <ExternalLink className="h-3 w-3 opacity-60" />}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2 } from "lucide-react"

export function PayButton({ invoiceId, label }: { invoiceId: string; label: string }) {
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    try {
      const res = await fetch(`/api/pay/${invoiceId}/checkout`, { method: "POST" })
      if (!res.ok) {
        const { error } = await res.json()
        alert(error || "حدث خطأ")
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="lg" className="w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={handlePay} disabled={loading}>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
      {label}
    </Button>
  )
}

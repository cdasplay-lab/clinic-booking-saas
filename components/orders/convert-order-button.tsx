"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface Props {
  orderId: string
  orderType: "so" | "po"
  disabled?: boolean
}

export function ConvertOrderButton({ orderId, orderType, disabled }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleConvert() {
    setLoading(true)
    setError("")
    const apiPath = orderType === "so"
      ? `/api/sales-orders/${orderId}/convert`
      : `/api/purchase-orders/${orderId}/convert`

    const res = await fetch(apiPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "فشل التحويل")
      setLoading(false)
      return
    }

    const redirectPath = orderType === "so"
      ? `/dashboard/invoices/${data.invoiceId}`
      : `/dashboard/bills/${data.billId}`
    router.push(redirectPath)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleConvert}
        disabled={disabled || loading}
        className="text-xs h-7"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : orderType === "so" ? "تحويل لفاتورة" : "تحويل لفاتورة مورد"}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

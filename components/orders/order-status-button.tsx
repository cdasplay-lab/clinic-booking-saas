"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface Props {
  orderId: string
  orderType: "so" | "po"
  newStatus: string
  label: string
  variant?: "outline" | "destructive" | "default"
}

export function OrderStatusButton({ orderId, orderType, newStatus, label, variant = "outline" }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleUpdate() {
    setLoading(true)
    const path = orderType === "so"
      ? `/api/sales-orders/${orderId}`
      : `/api/purchase-orders/${orderId}`
    await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <Button variant={variant} size="sm" onClick={handleUpdate} disabled={loading}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
    </Button>
  )
}

"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Pause, Play, Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface Props {
  recurringId: string
  status: string
}

export default function RecurringActions({ recurringId, status }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    const newStatus = status === "ACTIVE" ? "PAUSED" : "ACTIVE"
    await fetch(`/api/recurring/${recurringId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
    setLoading(false)
  }

  async function remove() {
    if (!confirm("حذف هذه الفاتورة المتكررة؟")) return
    setLoading(true)
    await fetch(`/api/recurring/${recurringId}`, { method: "DELETE" })
    router.refresh()
    setLoading(false)
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />

  return (
    <div className="flex gap-1">
      {status !== "ENDED" && (
        <Button variant="outline" size="sm" onClick={toggle} title={status === "ACTIVE" ? "إيقاف مؤقت" : "تشغيل"}>
          {status === "ACTIVE" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={remove} className="text-red-500 hover:text-red-700 hover:border-red-300">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

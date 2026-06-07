"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface Props {
  employeeId: string
  employeeName: string
}

export function DeactivateEmployeeButton({ employeeId, employeeName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDeactivate() {
    if (!confirm(`هل تريد إنهاء خدمة ${employeeName}؟`)) return
    setLoading(true)
    await fetch(`/api/payroll/employees/${employeeId}`, { method: "DELETE" })
    router.refresh()
    setLoading(false)
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDeactivate} disabled={loading}
      className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-7">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "إنهاء الخدمة"}
    </Button>
  )
}

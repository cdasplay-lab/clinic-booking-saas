"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Loader2, ChevronDown } from "lucide-react"

interface ExportButtonProps {
  type: "trial-balance" | "profit-loss" | "invoices" | "bills" | "journals"
  label?: string
  params?: Record<string, string>
}

export default function ExportButton({ type, label = "تصدير Excel", params = {} }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ type, ...params }).toString()
      const res = await fetch(`/api/reports/export?${qs}`)
      if (!res.ok) { alert("فشل التصدير"); return }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")

      // Get filename from Content-Disposition header
      const cd = res.headers.get("content-disposition") || ""
      const match = cd.match(/filename="?([^"]+)"?/)
      a.download = match ? decodeURIComponent(match[1]) : `${type}.xlsx`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin ml-2" />
        : <FileSpreadsheet className="h-4 w-4 ml-2 text-green-600" />
      }
      {label}
    </Button>
  )
}

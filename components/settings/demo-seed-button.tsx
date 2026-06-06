"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react"

export default function DemoSeedButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" })
      const data = await res.json()
      setResult(data.message || data.error)
      if (res.ok && data.created > 0) {
        setTimeout(() => window.location.href = "/dashboard", 1500)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={load} disabled={loading}>
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin ml-2" />
          : <Sparkles className="h-4 w-4 ml-2" />
        }
        تحميل بيانات تجريبية
      </Button>
      {result && (
        <span className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" /> {result}
        </span>
      )}
    </div>
  )
}

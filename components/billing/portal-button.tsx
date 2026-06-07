"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Settings } from "lucide-react"

export function PortalButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      if (!res.ok) {
        alert("تعذّر فتح بوابة إدارة الاشتراك")
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Settings className="h-4 w-4 ml-1" />}
      إدارة الاشتراك
    </Button>
  )
}

"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface Props {
  planId:      string
  label:       string
  variant?:    "default" | "outline" | "secondary"
  className?:  string
  disabled?:   boolean
}

export function CheckoutButton({ planId, label, variant = "default", className, disabled }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId }),
      })
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
    <Button
      className={className}
      variant={variant}
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </Button>
  )
}

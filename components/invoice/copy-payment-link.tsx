"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Link2, Check } from "lucide-react"

export function CopyPaymentLink({ invoiceId }: { invoiceId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/pay/${invoiceId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <><Check className="h-4 w-4 text-green-600" /> تم النسخ</>
      ) : (
        <><Link2 className="h-4 w-4" /> رابط الدفع</>
      )}
    </Button>
  )
}

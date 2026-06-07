"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, TrendingDown } from "lucide-react"

interface Props {
  assetId: string
  suggestedAmount: number
  currentValue: number
}

export function RecordDepreciationButton({ assetId, suggestedAmount, currentValue }: Props) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [amount, setAmount] = useState(suggestedAmount.toFixed(2))
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await fetch(`/api/fixed-assets/${assetId}/depreciate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), date }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "فشل تسجيل الإهلاك")
      setLoading(false)
      return
    }
    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <TrendingDown className="h-4 w-4 ml-1" />
        تسجيل إهلاك
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 bg-white border rounded-lg p-3 shadow-sm">
      <div>
        <Label className="text-xs">التاريخ</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm w-36" />
      </div>
      <div>
        <Label className="text-xs">المبلغ (أقصى {currentValue.toFixed(2)})</Label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          max={currentValue}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 text-sm w-28"
        />
      </div>
      {error && <p className="text-xs text-red-500 self-center">{error}</p>}
      <Button type="submit" size="sm" disabled={loading} className="h-8">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "حفظ"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-8">
        إلغاء
      </Button>
    </form>
  )
}

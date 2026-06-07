"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Barcode } from "lucide-react"

const STATUS_META: Record<string, { label: string; variant: any }> = {
  IN_STOCK:  { label: "في المخزون", variant: "success" },
  SOLD:      { label: "مُباع",       variant: "secondary" },
  RETURNED:  { label: "مُرتجع",      variant: "outline" },
  DEFECTIVE: { label: "تالف",        variant: "destructive" },
}

type Serial = {
  id: string; serialNumber: string; status: string
  condition: string; warrantyEnd: string | null
}

export default function SerialManager({ productId }: { productId: string }) {
  const [serials, setSerials] = useState<Serial[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [bulk, setBulk]       = useState("")
  const [condition, setCondition] = useState<"NEW" | "USED">("NEW")
  const [warranty, setWarranty]   = useState("")
  const [msg, setMsg]         = useState("")

  function load() {
    fetch(`/api/products/${productId}/serials`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSerials(data); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [productId])

  async function handleAdd() {
    const lines = bulk.split("\n").map((s) => s.trim()).filter(Boolean)
    if (lines.length === 0) return
    setAdding(true)
    setMsg("")
    const res = await fetch(`/api/products/${productId}/serials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serials: lines.map((sn) => ({
          serialNumber: sn,
          condition,
          warrantyMonths: warranty ? Number(warranty) : null,
        })),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg(`أُضيف ${data.added} رقم${data.skipped?.length ? ` — تم تجاهل ${data.skipped.length} مكرر` : ""}`)
      setBulk("")
      load()
    } else {
      setMsg(data.error || "خطأ")
    }
    setAdding(false)
  }

  const inStock = serials.filter((s) => s.status === "IN_STOCK").length
  const sold    = serials.filter((s) => s.status === "SOLD").length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <Badge variant="success">{inStock} في المخزون</Badge>
        <Badge variant="secondary">{sold} مُباع</Badge>
        <span className="text-gray-400">الإجمالي: {serials.length}</span>
      </div>

      {/* Add serials */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Barcode className="h-4 w-4" /> إضافة أرقام تسلسلية (رقم في كل سطر)
        </div>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={3}
          placeholder={"SN-001\nSN-002\nSN-003"}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-mono"
        />
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">الحالة</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value as any)}
              className="h-9 rounded-md border border-gray-200 px-2 text-sm">
              <option value="NEW">جديد</option>
              <option value="USED">مستعمل</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">ضمان (أشهر)</label>
            <Input type="number" value={warranty} onChange={(e) => setWarranty(e.target.value)}
              className="h-9 w-24" placeholder="12" />
          </div>
          <Button type="button" onClick={handleAdd} disabled={adding} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            إضافة
          </Button>
          {msg && <span className="text-xs text-green-600">{msg}</span>}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : serials.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">لا توجد أرقام تسلسلية بعد</p>
      ) : (
        <div className="border rounded-xl overflow-hidden divide-y max-h-64 overflow-y-auto">
          {serials.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50">
              <span className="font-mono">{s.serialNumber}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{s.condition === "USED" ? "مستعمل" : "جديد"}</span>
                <Badge variant={STATUS_META[s.status]?.variant}>{STATUS_META[s.status]?.label}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

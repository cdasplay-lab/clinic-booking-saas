"use client"
import { useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Search, Package, CheckCircle2, ShoppingCart, Wrench, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type Serial = {
  id: string
  serialNumber: string
  status: string
  condition: string
  warrantyMonths: number | null
  warrantyEnd: string | null
  soldDate: string | null
  notes: string | null
  product: { id: string; name: string; code: string; salePrice: number }
  soldInvoice: { id: string; number: string; date: string; contact: { name: string; phone: string | null } } | null
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  IN_STOCK:  { label: "في المخزون",    icon: Package,       color: "bg-green-100 text-green-700" },
  SOLD:      { label: "مُباع",          icon: ShoppingCart,  color: "bg-blue-100 text-blue-700" },
  RETURNED:  { label: "مُرتجع",        icon: ArrowRight,    color: "bg-amber-100 text-amber-700" },
  DEFECTIVE: { label: "صيانة / تالف",  icon: Wrench,        color: "bg-red-100 text-red-700" },
}

export default function SerialsSearchPage() {
  const [query, setQuery]     = useState("")
  const [results, setResults] = useState<Serial[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    const res = await fetch(`/api/inventory/serials?q=${encodeURIComponent(query.trim())}`)
    const data = await res.json()
    setResults(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  function warrantyStatus(s: Serial) {
    if (!s.warrantyEnd) return null
    const end  = new Date(s.warrantyEnd)
    const now  = new Date()
    const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000)
    if (days < 0) return { label: `انتهى الضمان (${Math.abs(days)} يوم مضى)`, color: "text-red-600" }
    if (days <= 30) return { label: `ضمان ينتهي خلال ${days} يوم`, color: "text-amber-600" }
    return { label: `ضمان ساري — ${Math.ceil(days / 30)} شهر متبقٍ`, color: "text-green-600" }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/inventory"><ArrowRight className="h-4 w-4 ml-1" /> المخزون</Link>
        </Button>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold">بحث الأرقام التسلسلية</h1>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        ابحث برقم تسلسلي لمعرفة حالة الجهاز، صاحبه، تاريخ البيع، وضمانه.
      </p>

      {/* Search bar */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="أدخل الرقم التسلسلي (مثال: CF1234567890)"
          dir="ltr"
          className="font-mono text-sm"
        />
        <Button onClick={search} disabled={loading || !query.trim()}>
          <Search className="h-4 w-4 ml-1" />
          {loading ? "جاري البحث..." : "بحث"}
        </Button>
      </div>

      {/* Results */}
      {searched && !loading && results.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">لم يُوجد رقم تسلسلي يطابق "{query}"</p>
          <p className="text-sm mt-1">تأكد من الرقم أو تحقق من إدخاله في النظام</p>
        </div>
      )}

      <div className="space-y-4">
        {results.map((s) => {
          const status  = statusConfig[s.status] || statusConfig.IN_STOCK
          const warranty = warrantyStatus(s)
          const StatusIcon = status.icon

          return (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="pt-5 space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-lg font-bold text-blue-700">{s.serialNumber}</p>
                    <Link href={`/dashboard/inventory/${s.product.id}`} className="text-sm text-gray-600 hover:text-blue-600">
                      {s.product.name} ({s.product.code})
                    </Link>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">الحالة</p>
                    <p>{s.condition === "NEW" ? "جديد" : "مستعمل"}</p>
                  </div>
                  {s.warrantyMonths && (
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">الضمان</p>
                      <p className={warranty?.color ?? "text-gray-600"}>{warranty?.label ?? `${s.warrantyMonths} شهر`}</p>
                    </div>
                  )}
                </div>

                {/* Sale info */}
                {s.soldInvoice && (
                  <div className="bg-blue-50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-bold text-blue-700 mb-2">معلومات البيع</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs">المشتري: </span>
                        <span className="font-medium">{s.soldInvoice.contact.name}</span>
                      </div>
                      {s.soldInvoice.contact.phone && (
                        <div>
                          <span className="text-gray-500 text-xs">الهاتف: </span>
                          <span dir="ltr" className="font-mono text-xs">{s.soldInvoice.contact.phone}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500 text-xs">تاريخ البيع: </span>
                        <span>{new Date(s.soldInvoice.date).toLocaleDateString("ar-SA")}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">رقم الفاتورة: </span>
                        <Link href={`/dashboard/invoices/${s.soldInvoice.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                          {s.soldInvoice.number}
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {s.notes && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">{s.notes}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

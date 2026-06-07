"use client"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

const DOC_LABELS: Record<string, string> = {
  INVOICE: "الفواتير",
  BILL:    "فواتير الموردين",
  QUOTE:   "عروض الأسعار",
  CN:      "إشعارات الخصم",
  DN:      "إشعارات الإضافة",
  PO:      "أوامر الشراء",
  SO:      "أوامر البيع",
  JOURNAL: "القيود اليومية",
  PAYMENT: "المدفوعات",
}

const ALL_TYPES = Object.keys(DOC_LABELS)
const DEFAULT_PREFIXES: Record<string, string> = {
  INVOICE: "INV", BILL: "BILL", QUOTE: "QT", CN: "CN", DN: "DN",
  PO: "PO", SO: "SO", JOURNAL: "JNL", PAYMENT: "PAY",
}

interface Sequence {
  docType: string
  prefix: string
  padding: number
  currentNumber: number
}

interface Props {
  sequences: Sequence[]
}

export default function NumberingSettings({ sequences }: Props) {
  const getSeq = (t: string): Sequence => {
    const existing = sequences.find((s) => s.docType === t)
    return existing ?? { docType: t, prefix: DEFAULT_PREFIXES[t] || t.slice(0, 3), padding: 4, currentNumber: 0 }
  }

  const [rows, setRows] = useState<Sequence[]>(ALL_TYPES.map(getSeq))
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function update(docType: string, field: "prefix" | "padding", value: string | number) {
    setRows((prev) => prev.map((r) => r.docType === docType ? { ...r, [field]: value } : r))
  }

  function preview(row: Sequence) {
    const next = row.currentNumber + 1
    return `${row.prefix.toUpperCase()}-${String(next).padStart(row.padding, "0")}`
  }

  async function save(docType: string) {
    const row = rows.find((r) => r.docType === docType)
    if (!row) return
    setSaving(docType)
    setError(null)
    const res = await fetch("/api/settings/numbering", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType: row.docType, prefix: row.prefix, padding: row.padding }),
    })
    if (res.ok) {
      setSaved(docType)
      setTimeout(() => setSaved(null), 2000)
    } else {
      const d = await res.json()
      setError(d.error || "فشل الحفظ")
    }
    setSaving(null)
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {rows.map((row) => (
        <Card key={row.docType}>
          <CardContent className="py-4 px-5">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Label */}
              <div className="w-40 flex-shrink-0">
                <p className="font-medium text-sm">{DOC_LABELS[row.docType]}</p>
                <p className="text-xs text-gray-400 font-mono">{row.docType}</p>
              </div>

              {/* Prefix */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-12 flex-shrink-0">البادئة</label>
                <Input
                  value={row.prefix}
                  onChange={(e) => update(row.docType, "prefix", e.target.value.toUpperCase())}
                  className="w-24 text-sm font-mono uppercase h-8"
                  maxLength={10}
                  dir="ltr"
                />
              </div>

              {/* Padding */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-12 flex-shrink-0">الأرقام</label>
                <select
                  value={row.padding}
                  onChange={(e) => update(row.docType, "padding", Number(e.target.value))}
                  className="w-16 text-sm h-8 rounded-md border border-input bg-background px-2 text-center"
                  dir="ltr"
                >
                  {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs text-gray-500 flex-shrink-0">مثال</label>
                <code className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md text-sm font-mono border border-blue-100">
                  {preview(row)}
                </code>
              </div>

              {/* Save */}
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0 h-8"
                onClick={() => save(row.docType)}
                disabled={saving === row.docType}
              >
                {saving === row.docType ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saved === row.docType ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-1" /> تم</>
                ) : (
                  "حفظ"
                )}
              </Button>
            </div>

            {/* Current counter info */}
            {row.currentNumber > 0 && (
              <p className="text-xs text-gray-400 mt-2 mr-40">
                آخر رقم مستخدم: {row.currentNumber} — الرقم القادم: {preview(row)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

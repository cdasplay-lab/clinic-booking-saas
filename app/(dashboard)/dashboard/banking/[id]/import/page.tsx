"use client"
import { useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Upload, ArrowRight, AlertCircle, CheckCircle2, FileText, TrendingUp, TrendingDown } from "lucide-react"
import Link from "next/link"

interface ParsedRow {
  date:        string
  description: string
  debit:       number
  credit:      number
  balance:     number
  isDuplicate: boolean
}

type Step = "upload" | "preview" | "done"

export default function BankImportPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [step, setStep]           = useState<Step>("upload")
  const [parsing, setParsing]     = useState(false)
  const [importing, setImporting] = useState(false)
  const [rows, setRows]           = useState<ParsedRow[]>([])
  const [selected, setSelected]   = useState<Set<number>>(new Set())
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [result, setResult]       = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError]         = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    setError("")
    setParseErrors([])

    const fd = new FormData()
    fd.append("file", file)

    try {
      const res = await fetch(`/api/banking/${id}/import`, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "فشل تحليل الملف"); setParsing(false); return }

      setRows(data.rows || [])
      setParseErrors(data.errors || [])
      // Pre-select all non-duplicate rows
      const sel = new Set<number>()
      ;(data.rows || []).forEach((r: ParsedRow, i: number) => { if (!r.isDuplicate) sel.add(i) })
      setSelected(sel)
      setStep("preview")
    } catch {
      setError("حدث خطأ أثناء تحليل الملف")
    } finally {
      setParsing(false)
    }
  }

  function toggleRow(i: number) {
    const s = new Set(selected)
    if (s.has(i)) s.delete(i)
    else s.add(i)
    setSelected(s)
  }

  function toggleAll() {
    if (selected.size === rows.filter((r) => !r.isDuplicate).length) {
      setSelected(new Set())
    } else {
      const s = new Set<number>()
      rows.forEach((r, i) => { if (!r.isDuplicate) s.add(i) })
      setSelected(s)
    }
  }

  async function confirmImport() {
    const toImport = rows.filter((_, i) => selected.has(i))
    if (!toImport.length) { setError("لم تحدد أي حركات للاستيراد"); return }

    setImporting(true)
    setError("")

    try {
      const res = await fetch(`/api/banking/${id}/import/confirm`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows: toImport }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "فشل الاستيراد"); setImporting(false); return }
      setResult({ imported: data.imported, skipped: data.skipped })
      setStep("done")
    } catch {
      setError("حدث خطأ أثناء الاستيراد")
    } finally {
      setImporting(false)
    }
  }

  const newRows  = rows.filter((r) => !r.isDuplicate).length
  const dupRows  = rows.filter((r) =>  r.isDuplicate).length
  const totalIn  = rows.filter((_, i) => selected.has(i)).reduce((s, r) => s + r.credit, 0)
  const totalOut = rows.filter((_, i) => selected.has(i)).reduce((s, r) => s + r.debit,  0)

  return (
    <div className="max-w-5xl mx-auto space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/banking/${id}`}><ArrowRight className="h-4 w-4 ml-1" /> تفاصيل الحساب</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        {["upload", "preview", "done"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? "bg-blue-600 text-white" :
              (["upload","preview","done"].indexOf(step) > i) ? "bg-green-500 text-white" :
              "bg-gray-200 text-gray-500"
            }`}>{i + 1}</div>
            <span className="text-sm text-gray-600">
              {s === "upload" ? "رفع الملف" : s === "preview" ? "مراجعة البيانات" : "تأكيد الاستيراد"}
            </span>
            {i < 2 && <div className="h-px w-8 bg-gray-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              استيراد كشف الحساب البنكي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {parsing ? (
                <Loader2 className="h-10 w-10 mx-auto text-blue-500 animate-spin" />
              ) : (
                <>
                  <FileText className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                  <p className="font-medium text-gray-700">اضغط لاختيار ملف CSV أو Excel</p>
                  <p className="text-sm text-gray-400 mt-1">يدعم الملفات: .csv / .xlsx / .xls</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">تعليمات:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>قم بتنزيل كشف الحساب من موقع البنك بصيغة CSV أو Excel</li>
                <li>يجب أن يحتوي الملف على أعمدة: التاريخ، الوصف، المبلغ (مدين/دائن)، الرصيد</li>
                <li>مدعوم: البنك الأهلي، الراجحي، الرياض، بنك مسقط، وغيرها</li>
                <li>سيتم تجاهل الحركات المستوردة مسبقاً تلقائياً</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Preview ── */}
      {step === "preview" && (
        <>
          {parseErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
              {parseErrors.map((e, i) => <p key={i} className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />{e}</p>)}
            </div>
          )}

          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "إجمالي الحركات", value: rows.length,   color: "text-gray-700" },
              { label: "جديدة",          value: newRows,         color: "text-blue-600" },
              { label: "مكررة (ستُتجاهل)", value: dupRows,      color: "text-amber-600" },
              { label: "محددة للاستيراد", value: selected.size, color: "text-green-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white border rounded-lg p-3">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">حركات الكشف البنكي</CardTitle>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-700 font-mono">+{fmt(totalIn)}</span>
                  <span className="text-red-600 font-mono">-{fmt(totalOut)}</span>
                  <Button variant="outline" size="sm" onClick={toggleAll}>
                    {selected.size === newRows ? "إلغاء تحديد الكل" : "تحديد الكل"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow className="text-xs">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead className="text-left">إيداع</TableHead>
                    <TableHead className="text-left">سحب</TableHead>
                    <TableHead className="text-left">الرصيد</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      key={i}
                      className={`text-sm cursor-pointer ${row.isDuplicate ? "opacity-40" : "hover:bg-gray-50"} ${selected.has(i) ? "bg-blue-50" : ""}`}
                      onClick={() => !row.isDuplicate && toggleRow(i)}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          disabled={row.isDuplicate}
                          onChange={() => toggleRow(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-blue-600"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {new Date(row.date).toLocaleDateString("ar-SA")}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={row.description}>
                        {row.description || "—"}
                      </TableCell>
                      <TableCell className="text-left font-mono text-green-700 text-sm">
                        {row.credit > 0 ? (
                          <span className="flex items-center gap-1 justify-end">
                            <TrendingUp className="h-3 w-3" />{fmt(row.credit)}
                          </span>
                        ) : ""}
                      </TableCell>
                      <TableCell className="text-left font-mono text-red-600 text-sm">
                        {row.debit > 0 ? (
                          <span className="flex items-center gap-1 justify-end">
                            <TrendingDown className="h-3 w-3" />{fmt(row.debit)}
                          </span>
                        ) : ""}
                      </TableCell>
                      <TableCell className="text-left font-mono text-sm">{fmt(row.balance)}</TableCell>
                      <TableCell>
                        {row.isDuplicate && (
                          <Badge className="text-xs bg-amber-100 text-amber-700 border-0">مكرر</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={confirmImport} disabled={importing || selected.size === 0}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              استيراد {selected.size} حركة
            </Button>
            <Button variant="outline" onClick={() => { setStep("upload"); setRows([]); setSelected(new Set()); if (fileRef.current) fileRef.current.value = "" }}>
              رفع ملف آخر
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/dashboard/banking/${id}`}>إلغاء</Link>
            </Button>
          </div>
        </>
      )}

      {/* ── Step 3: Done ── */}
      {step === "done" && result && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-700">تم الاستيراد بنجاح</h2>
              <p className="text-gray-500 mt-1">
                تم استيراد <span className="font-bold text-gray-800">{result.imported}</span> حركة
                {result.skipped > 0 && <span> · تم تجاهل {result.skipped} حركة مكررة</span>}
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <Button asChild>
                <Link href={`/dashboard/banking/${id}`}>عرض الحساب</Link>
              </Button>
              <Button variant="outline" onClick={() => { setStep("upload"); setRows([]); setSelected(new Set()); setResult(null); if (fileRef.current) fileRef.current.value = "" }}>
                استيراد ملف آخر
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

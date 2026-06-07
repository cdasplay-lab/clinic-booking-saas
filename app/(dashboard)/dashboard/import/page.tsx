"use client"
import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Upload, Download, CheckCircle, XCircle, Loader2, Users, Package, FileSpreadsheet, AlertTriangle
} from "lucide-react"

type ImportType = "contacts" | "products"
type RowResult = { row: number; name: string; status: "ok" | "error"; error?: string }

const importTypes: { id: ImportType; label: string; desc: string; icon: any; endpoint: string }[] = [
  {
    id: "contacts",
    label: "جهات الاتصال",
    desc: "استيراد عملاء وموردين من Excel أو CSV",
    icon: Users,
    endpoint: "/api/import/contacts",
  },
  {
    id: "products",
    label: "المنتجات والخدمات",
    desc: "استيراد قائمة المنتجات مع الأسعار",
    icon: Package,
    endpoint: "/api/import/products",
  },
]

export default function ImportPage() {
  const [selected, setSelected] = useState<ImportType>("contacts")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<RowResult[] | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const current = importTypes.find((t) => t.id === selected)!

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError("")
    if (inputRef.current) inputRef.current.value = ""
  }

  function handleTypeChange(type: ImportType) {
    setSelected(type)
    reset()
  }

  async function handleFile(f: File) {
    setFile(f)
    setPreview(null)
    setResult(null)
    setError("")
    setLoading(true)

    const fd = new FormData()
    fd.append("file", f)
    fd.append("preview", "1")

    try {
      const res = await fetch(current.endpoint, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "فشل المعاينة"); setLoading(false); return }
      setPreview(data.results)
    } catch {
      setError("خطأ في الاتصال")
    }
    setLoading(false)
  }

  async function confirmImport() {
    if (!file) return
    setLoading(true)
    setError("")

    const fd = new FormData()
    fd.append("file", file)

    try {
      const res = await fetch(current.endpoint, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "فشل الاستيراد"); setLoading(false); return }
      setResult({ imported: data.imported, skipped: data.skipped })
      setPreview(null)
    } catch {
      setError("خطأ في الاتصال")
    }
    setLoading(false)
  }

  const okRows = preview?.filter((r) => r.status === "ok") || []
  const errRows = preview?.filter((r) => r.status === "error") || []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-green-600" />
          استيراد البيانات
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          استيراد بيانات من ملفات Excel أو CSV بشكل مجمّع
        </p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 gap-3">
        {importTypes.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTypeChange(t.id)}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 text-right transition-all ${
              selected === t.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <t.icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${selected === t.id ? "text-blue-600" : "text-gray-400"}`} />
            <div>
              <p className={`font-medium text-sm ${selected === t.id ? "text-blue-700" : "text-gray-700"}`}>{t.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Download template */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">قالب Excel</p>
              <p className="text-xs text-gray-500 mt-0.5">حمّل القالب واملأ بياناتك به ثم ارفعه</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/import/template?type=${selected}`} download>
                <Download className="h-4 w-4" />
                تحميل القالب
              </a>
            </Button>
          </div>

          {/* Column reference */}
          <div className="mt-3 bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">الأعمدة المطلوبة:</p>
            <div className="flex flex-wrap gap-1.5">
              {selected === "contacts" && (
                <>
                  <ColBadge name="name" required />
                  <ColBadge name="type" hint="CUSTOMER | VENDOR | BOTH" />
                  <ColBadge name="email" />
                  <ColBadge name="phone" />
                  <ColBadge name="address" />
                  <ColBadge name="taxNumber" />
                  <ColBadge name="paymentTerms" hint="أيام، افتراضي 30" />
                </>
              )}
              {selected === "products" && (
                <>
                  <ColBadge name="name" required />
                  <ColBadge name="code" hint="يُنشأ تلقائياً إن لم يُحدد" />
                  <ColBadge name="salePrice" />
                  <ColBadge name="purchasePrice" />
                  <ColBadge name="unit" hint="PCS, KG, BOX..." />
                  <ColBadge name="category" />
                  <ColBadge name="description" />
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">يمكن استخدام أسماء الأعمدة بالعربية أيضاً (الاسم، النوع، البريد...)</p>
          </div>
        </CardContent>
      </Card>

      {/* Upload zone */}
      {!result && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              {loading ? (
                <div className="flex flex-col items-center gap-2 text-blue-600">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">جاري قراءة الملف...</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-400">انقر لتغيير الملف</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Upload className="h-8 w-8" />
                  <p className="text-sm font-medium">اسحب ملف Excel أو CSV هنا</p>
                  <p className="text-xs">أو انقر للاختيار</p>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && preview.length > 0 && !result && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>{okRows.length} صف صالح</span>
                </div>
                {errRows.length > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>{errRows.length} صف به خطأ</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>إلغاء</Button>
                <Button size="sm" onClick={confirmImport} disabled={loading || okRows.length === 0}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  استيراد {okRows.length} صف
                </Button>
              </div>
            </div>

            {errRows.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-orange-700 text-sm font-medium mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  الصفوف التي بها أخطاء (لن تُستورد)
                </div>
                <div className="space-y-1">
                  {errRows.slice(0, 5).map((r) => (
                    <p key={r.row} className="text-xs text-orange-600">
                      السطر {r.row}: {r.name} — {r.error}
                    </p>
                  ))}
                  {errRows.length > 5 && (
                    <p className="text-xs text-orange-400">...و{errRows.length - 5} أخطاء إضافية</p>
                  )}
                </div>
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">السطر</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">الاسم</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((r) => (
                    <tr key={r.row} className="border-b last:border-0">
                      <td className="px-3 py-2 text-gray-400 text-xs">{r.row}</td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">
                        {r.status === "ok" ? (
                          <span className="text-green-600 text-xs flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> صالح
                          </span>
                        ) : (
                          <span className="text-red-500 text-xs flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> {r.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  ...عرض أول 20 من {preview.length} صف
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {result && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-700">تم الاستيراد بنجاح</p>
              <p className="text-gray-600 mt-1">
                تم استيراد <strong>{result.imported}</strong> سجل
                {result.skipped > 0 && ` · تم تخطي ${result.skipped} سجل`}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={reset}>
                <Upload className="h-4 w-4" />
                استيراد ملف آخر
              </Button>
              {selected === "contacts" && (
                <Button variant="outline" asChild>
                  <a href="/dashboard/contacts/customers">عرض جهات الاتصال</a>
                </Button>
              )}
              {selected === "products" && (
                <Button variant="outline" asChild>
                  <a href="/dashboard/inventory">عرض المنتجات</a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ColBadge({ name, required, hint }: { name: string; required?: boolean; hint?: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-white border rounded px-2 py-0.5 text-xs">
      <code className="text-blue-700">{name}</code>
      {required && <span className="text-red-500">*</span>}
      {hint && <span className="text-gray-400 text-xs">{hint}</span>}
    </span>
  )
}

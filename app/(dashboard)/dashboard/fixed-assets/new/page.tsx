"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, Briefcase } from "lucide-react"
import Link from "next/link"

const CATEGORIES = ["أجهزة وحواسيب", "سيارات ومركبات", "معدات ومكائن", "أثاث ومفروشات", "مباني وعقارات", "برمجيات", "أخرى"]
const METHODS: Record<string, string> = {
  STRAIGHT_LINE: "القسط الثابت (Straight Line)",
  DECLINING_BALANCE: "القسط المتناقص (Declining Balance)",
  SUM_OF_YEARS: "مجموع السنوات (Sum of Years)",
}

export default function NewFixedAssetPage() {
  const router = useRouter()
  const today = new Date().toISOString().split("T")[0]

  const [form, setForm] = useState({
    name: "",
    code: "",
    category: "معدات ومكائن",
    purchaseDate: today,
    purchasePrice: "",
    depreciationMethod: "STRAIGHT_LINE",
    usefulLife: "5",
    salvageValue: "0",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const annualDepr = form.purchasePrice && form.usefulLife
    ? ((Number(form.purchasePrice) - Number(form.salvageValue || 0)) / Number(form.usefulLife)).toLocaleString("ar-SA", { minimumFractionDigits: 2 })
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await fetch("/api/fixed-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        purchasePrice: Number(form.purchasePrice),
        usefulLife: Number(form.usefulLife),
        salvageValue: Number(form.salvageValue || 0),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push("/dashboard/fixed-assets")
    } else {
      setError(data.error || "حدث خطأ")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/fixed-assets">
            <ArrowRight className="h-4 w-4 ml-1" /> الأصول الثابتة
          </Link>
        </Button>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold">إضافة أصل ثابت</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">معلومات الأصل</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>اسم الأصل *</Label>
              <Input value={form.name} onChange={set("name")} placeholder="سيارة تويوتا هايلكس" required />
            </div>
            <div className="space-y-1.5">
              <Label>الرمز *</Label>
              <Input value={form.code} onChange={set("code")} placeholder="VEH-001" required dir="ltr" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>الفئة</Label>
            <select
              value={form.category}
              onChange={set("category")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>تاريخ الشراء *</Label>
              <Input type="date" value={form.purchaseDate} onChange={set("purchaseDate")} required dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>تكلفة الشراء *</Label>
              <Input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={set("purchasePrice")} required dir="ltr" placeholder="50000" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">إعدادات الإهلاك</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>طريقة الإهلاك</Label>
            <select
              value={form.depreciationMethod}
              onChange={set("depreciationMethod")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>العمر الإنتاجي (سنوات)</Label>
              <Input type="number" min="1" max="100" value={form.usefulLife} onChange={set("usefulLife")} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>القيمة التخريدية</Label>
              <Input type="number" min="0" step="0.01" value={form.salvageValue} onChange={set("salvageValue")} dir="ltr" placeholder="0" />
            </div>
          </div>
          {annualDepr && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <p className="text-sm text-blue-700">
                الإهلاك السنوي (طريقة القسط الثابت): <span className="font-bold">{annualDepr}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          إضافة الأصل
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/fixed-assets">إلغاء</Link>
        </Button>
      </div>
    </form>
  )
}

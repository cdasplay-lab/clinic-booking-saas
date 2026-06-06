"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Loader2, CheckCircle2, ChevronDown } from "lucide-react"
import { COUNTRY_LIST, getCountry, type CountryCode } from "@/lib/countries"

const PRIORITY: CountryCode[] = ["IQ", "SA", "AE", "KW", "QA", "BH", "OM"]
const orderedCountries = [
  ...PRIORITY.map((c) => COUNTRY_LIST.find((x) => x.code === c)!),
  ...COUNTRY_LIST.filter((c) => !PRIORITY.includes(c.code as CountryCode)),
]

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]

interface OrgSettingsFormProps {
  org: {
    id: string
    name: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    country: string
    taxNumber: string | null
    logo: string | null
    fiscalYearStart: number
    plan: string
    baseCurrency: string
  }
}

export default function OrgSettingsForm({ org }: OrgSettingsFormProps) {
  const [form, setForm] = useState({
    name: org.name,
    email: org.email || "",
    phone: org.phone || "",
    address: org.address || "",
    city: org.city || "",
    country: org.country as CountryCode,
    taxNumber: org.taxNumber || "",
    logo: org.logo || "",
    fiscalYearStart: org.fiscalYearStart,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const country = getCountry(form.country)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError("")

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const d = await res.json()
      setError(d.error || "فشل الحفظ")
    }
    setSaving(false)
  }

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  return (
    <form onSubmit={handleSave}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle>معلومات الشركة</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
          )}

          {/* Logo URL */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {form.logo ? (
                <img src={form.logo} alt="لوجو الشركة" className="w-16 h-16 rounded-lg object-contain border" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {form.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <Label>رابط اللوجو (URL)</Label>
              <Input
                value={form.logo}
                onChange={set("logo")}
                placeholder="https://example.com/logo.png"
                dir="ltr"
              />
              <p className="text-xs text-gray-400">ارفع لوجوك على imgur.com أو cloudinary وضع الرابط هنا</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم الشركة *</Label>
              <Input value={form.name} onChange={set("name")} required />
            </div>
            <div className="space-y-2">
              <Label>
                {country.zatcaRequired ? "الرقم الضريبي (ZATCA)" : country.ftaRequired ? "رقم TRN" : "الرقم الضريبي / السجل التجاري"}
              </Label>
              <Input value={form.taxNumber} onChange={set("taxNumber")} placeholder="300000000000003" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="info@company.com" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder={country.phonePrefix} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>المدينة</Label>
              <Input value={form.city} onChange={set("city")} placeholder="بغداد" />
            </div>
            <div className="col-span-1 space-y-2">
              <Label>العنوان التفصيلي</Label>
              <Input value={form.address} onChange={set("address")} placeholder="شارع الرشيد، مبنى رقم 5" />
            </div>
          </div>

          {/* Country + Currency */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-2">
              <Label>الدولة</Label>
              <div className="relative">
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value as CountryCode }))}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {orderedCountries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.nameAr}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>بداية السنة المالية</Label>
              <div className="relative">
                <select
                  value={form.fiscalYearStart}
                  onChange={(e) => setForm((f) => ({ ...f, fiscalYearStart: Number(e.target.value) }))}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Country info */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
              العملة: {country.currencyAr} ({country.currencySymbol})
            </span>
            {country.vatEnabled ? (
              <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-full">
                {country.vatName}
              </span>
            ) : (
              <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full">
                لا ضريبة قيمة مضافة
              </span>
            )}
            {country.zatcaRequired && (
              <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full">ZATCA مطلوب</span>
            )}
            {country.ftaRequired && (
              <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full">FTA مطلوب</span>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              حفظ التغييرات
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                تم الحفظ بنجاح
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

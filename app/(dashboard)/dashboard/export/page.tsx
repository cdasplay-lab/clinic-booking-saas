"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  FileText, Users, CreditCard, Package, BookOpen,
  FileStack, BarChart3, Download, Archive, Mail, CheckCircle, Loader2,
} from "lucide-react"

const EXPORT_MODULES = [
  { key: "invoices",  label: "الفواتير",            icon: FileText,  desc: "جميع فواتير المبيعات" },
  { key: "bills",     label: "فواتير الموردين",      icon: FileText,  desc: "جميع فواتير المشتريات" },
  { key: "payments",  label: "المدفوعات",            icon: CreditCard, desc: "سجل المدفوعات الصادرة والواردة" },
  { key: "contacts",  label: "جهات الاتصال",        icon: Users,     desc: "العملاء والموردون" },
  { key: "products",  label: "المنتجات والخدمات",   icon: Package,   desc: "دليل المنتجات" },
  { key: "accounts",  label: "دليل الحسابات",       icon: BookOpen,  desc: "شجرة الحسابات المحاسبية" },
  { key: "journals",  label: "القيود اليومية",      icon: FileStack, desc: "آخر 1000 قيد يومي" },
  { key: "trial-balance", label: "ميزان المراجعة", icon: BarChart3, desc: "الأرصدة الحالية لجميع الحسابات" },
  { key: "profit-loss",   label: "الأرباح والخسائر", icon: BarChart3, desc: "تقرير الإيرادات والمصروفات" },
]

export default function ExportPage() {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [backupLoading, setBackupLoading] = useState(false)

  // Backup settings state
  const [backupEnabled, setBackupEnabled] = useState(false)
  const [backupEmail, setBackupEmail] = useState("")
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  async function downloadModule(key: string) {
    setDownloading(key)
    try {
      const res = await fetch(`/api/reports/export?type=${key}`)
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = res.headers.get("content-disposition")
        ?.match(/filename\*?=(?:UTF-8'')?(.+)/i)?.[1]
        ? decodeURIComponent(res.headers.get("content-disposition")!.match(/filename\*?=(?:UTF-8'')?(.+)/i)![1])
        : `export_${key}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setDone((prev) => new Set(prev).add(key))
    } catch {
      alert("حدث خطأ أثناء التصدير")
    } finally {
      setDownloading(null)
    }
  }

  async function downloadFullBackup() {
    setBackupLoading(true)
    try {
      const res = await fetch("/api/backup")
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = res.headers.get("content-disposition")
        ?.match(/filename\*?=(?:UTF-8'')?(.+)/i)?.[1]
        ? decodeURIComponent(res.headers.get("content-disposition")!.match(/filename\*?=(?:UTF-8'')?(.+)/i)![1])
        : `backup_full.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("حدث خطأ أثناء إنشاء النسخة الاحتياطية")
    } finally {
      setBackupLoading(false)
    }
  }

  async function saveBackupSettings() {
    setSettingsSaving(true)
    setSettingsSaved(false)
    try {
      const res = await fetch("/api/settings/backup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupEnabled, backupEmail: backupEmail || null }),
      })
      if (!res.ok) throw new Error()
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 3000)
    } catch {
      alert("تعذر حفظ الإعدادات")
    } finally {
      setSettingsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">تصدير البيانات والنسخ الاحتياطي</h1>
          <p className="text-sm text-gray-500 mt-1">تنزيل بياناتك بصيغة Excel أو إنشاء نسخة احتياطية شاملة</p>
        </div>
      </div>

      {/* Full Backup */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Archive className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">نسخة احتياطية شاملة</h2>
                <p className="text-sm text-gray-500">
                  ملف Excel واحد يحتوي على جميع البيانات: الفواتير، المدفوعات، جهات الاتصال، المنتجات، الحسابات، والقيود اليومية
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={downloadFullBackup}
              disabled={backupLoading}
              className="bg-blue-600 hover:bg-blue-700 gap-2 shrink-0"
            >
              {backupLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري الإنشاء...</>
              ) : (
                <><Download className="h-4 w-4" /> تنزيل النسخة الاحتياطية</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Modules */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">تصدير حسب القسم</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPORT_MODULES.map(({ key, label, icon: Icon, desc }) => (
            <Card key={key} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center mt-0.5 shrink-0">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">{label}</p>
                        {done.has(key) && (
                          <Badge variant="outline" className="text-green-600 border-green-300 text-xs px-1 py-0">
                            <CheckCircle className="h-3 w-3 ml-1" /> تم
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadModule(key)}
                    disabled={downloading === key}
                    className="shrink-0"
                  >
                    {downloading === key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Scheduled Backup Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-base">النسخ الاحتياطي الأسبوعي التلقائي</CardTitle>
          </div>
          <CardDescription>
            يُرسَل تلقائياً كل أسبوع (الأحد الساعة 6 صباحاً) ملف Excel مرفق بجميع بيانات المنظمة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="backup-toggle" className="text-sm font-medium">تفعيل النسخ الاحتياطي الأسبوعي</Label>
            <Switch
              id="backup-toggle"
              checked={backupEnabled}
              onCheckedChange={setBackupEnabled}
            />
          </div>

          {backupEnabled && (
            <div className="space-y-2">
              <Label htmlFor="backup-email" className="text-sm">البريد الإلكتروني للنسخة الاحتياطية</Label>
              <Input
                id="backup-email"
                type="email"
                placeholder="backup@example.com (اختياري — يُستخدم بريد المنظمة إذا تُرك فارغاً)"
                value={backupEmail}
                onChange={(e) => setBackupEmail(e.target.value)}
                dir="ltr"
              />
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={saveBackupSettings}
              disabled={settingsSaving}
              size="sm"
            >
              {settingsSaving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> جاري الحفظ...</>
              ) : "حفظ الإعدادات"}
            </Button>
            {settingsSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> تم الحفظ
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

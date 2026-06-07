"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Bell, Loader2, CheckCircle2 } from "lucide-react"

interface Props {
  enabled: boolean
  days: string
}

export default function ReminderSettings({ enabled, days }: Props) {
  const [reminderEnabled, setReminderEnabled] = useState(enabled)
  const [reminderDays, setReminderDays] = useState(days)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch("/api/settings/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderEnabled, reminderDays }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || "فشل الحفظ")
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const presets = [
    { label: "يوم واحد، أسبوع، أسبوعان", value: "1,7,14" },
    { label: "يوم، 3 أيام، أسبوع", value: "1,3,7" },
    { label: "يوم، أسبوع، شهر", value: "1,7,30" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-medium text-sm">تذكيرات الفواتير المتأخرة</Label>
          <p className="text-xs text-gray-500 mt-0.5">
            إرسال بريد إلكتروني تلقائي للعملاء عند تأخر السداد
          </p>
        </div>
        <Switch
          checked={reminderEnabled}
          onCheckedChange={setReminderEnabled}
        />
      </div>

      {reminderEnabled && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 border">
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">
              أيام الإرسال بعد تاريخ الاستحقاق (مفصولة بفواصل)
            </Label>
            <Input
              value={reminderDays}
              onChange={(e) => setReminderDays(e.target.value)}
              placeholder="مثال: 1,7,14"
              className="h-9 text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              مثال: 1,7,14 يعني إرسال بعد يوم واحد، أسبوع، وأسبوعين من تاريخ الاستحقاق
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setReminderDays(p.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  reminderDays === p.value
                    ? "bg-blue-100 border-blue-400 text-blue-700 font-medium"
                    : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
          حفظ إعدادات التذكير
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            تم الحفظ
          </span>
        )}
      </div>
    </div>
  )
}

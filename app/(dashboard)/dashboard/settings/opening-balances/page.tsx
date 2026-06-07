"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, CheckCircle2, Info } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

type Acct = {
  id: string; code: string; name: string
  nature: "DEBIT" | "CREDIT"; accountType: string; groupName: string
}

export default function OpeningBalancesPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Acct[]>([])
  const [values, setValues]     = useState<Record<string, string>>({})
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState("")

  useEffect(() => {
    fetch("/api/opening-balances").then((r) => r.json()).then((data) => {
      setAccounts(data.accounts || [])
      if (data.existing) {
        setDate(new Date(data.existing.date).toISOString().slice(0, 10))
        const v: Record<string, string> = {}
        for (const l of data.existing.lines) {
          const amt = l.debit > 0 ? l.debit : l.credit
          if (amt > 0) v[l.accountId] = String(amt)
        }
        setValues(v)
      }
      setLoading(false)
    })
  }, [])

  function setVal(id: string, val: string) {
    setValues((prev) => ({ ...prev, [id]: val }))
  }

  // A positive value posts to the account's natural side
  let totalDebit = 0, totalCredit = 0
  for (const a of accounts) {
    const amt = Number(values[a.id] || 0)
    if (amt <= 0) continue
    if (a.nature === "DEBIT") totalDebit += amt
    else totalCredit += amt
  }
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100

  async function handleSave() {
    setError("")
    const balances = accounts
      .map((a) => {
        const amt = Number(values[a.id] || 0)
        if (amt <= 0) return null
        return a.nature === "DEBIT"
          ? { accountId: a.id, debit: amt, credit: 0 }
          : { accountId: a.id, debit: 0, credit: amt }
      })
      .filter(Boolean)

    if (balances.length === 0) { setError("أدخل رصيداً واحداً على الأقل"); return }

    setSaving(true)
    const res = await fetch("/api/opening-balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, balances }),
    })
    if (res.ok) setDone(true)
    else { const d = await res.json(); setError(d.error || "خطأ") }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center pt-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-xl font-bold">تم حفظ الأرصدة الافتتاحية</h2>
        <p className="text-gray-500 text-center max-w-md">
          تم إنشاء قيد افتتاحي متوازن. أي فرق تمت تسويته تلقائياً على حساب الأرباح المبقاة.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => router.push("/dashboard/reports/trial-balance")}>عرض ميزان المراجعة</Button>
          <Button variant="outline" onClick={() => setDone(false)}>تعديل</Button>
        </div>
      </div>
    )
  }

  // Group accounts by group name
  const grouped = accounts.reduce((acc, a) => {
    (acc[a.groupName] ??= []).push(a)
    return acc
  }, {} as Record<string, Acct[]>)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/settings"><ArrowRight className="h-4 w-4" /> الإعدادات</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">الأرصدة الافتتاحية</h1>
        <p className="text-sm text-gray-500">أدخل أرصدة حساباتك من نظامك السابق عند بدء استخدام HesabPro</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-2 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>أدخل الرصيد لكل حساب كما هو في ميزان المراجعة القديم. أي فرق بين المدين والدائن يُسوّى تلقائياً على الأرباح المبقاة.</span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">تاريخ بدء الأرصدة</CardTitle>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {Object.entries(grouped).map(([groupName, accts]) => (
            <div key={groupName}>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">{groupName}</p>
              <div className="space-y-1.5">
                {accts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-gray-400 w-12">{a.code}</span>
                    <span className="flex-1 text-sm">{a.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.nature === "DEBIT" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {a.nature === "DEBIT" ? "مدين" : "دائن"}
                    </span>
                    <Input
                      type="number" step="0.01"
                      value={values[a.id] || ""}
                      onChange={(e) => setVal(a.id, e.target.value)}
                      className="w-36 h-8 text-left font-mono"
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totals bar */}
      <div className="sticky bottom-4 bg-white border rounded-xl shadow-lg p-4 flex items-center justify-between">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-gray-500">إجمالي المدين: </span>
            <span className="font-bold text-green-600">{formatCurrency(totalDebit)}</span>
          </div>
          <div>
            <span className="text-gray-500">إجمالي الدائن: </span>
            <span className="font-bold text-blue-600">{formatCurrency(totalCredit)}</span>
          </div>
          <div>
            <span className="text-gray-500">الفرق: </span>
            <span className={`font-bold ${Math.abs(diff) < 0.01 ? "text-gray-400" : "text-amber-600"}`}>
              {formatCurrency(Math.abs(diff))}
              {Math.abs(diff) >= 0.01 && <span className="text-xs"> ← أرباح مبقاة</span>}
            </span>
          </div>
        </div>
        {error && <span className="text-red-600 text-sm">{error}</span>}
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          حفظ الأرصدة الافتتاحية
        </Button>
      </div>
    </div>
  )
}

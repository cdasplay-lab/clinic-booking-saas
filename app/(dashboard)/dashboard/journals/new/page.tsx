"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Plus, Trash2, ArrowRight, AlertCircle } from "lucide-react"
import Link from "next/link"

interface JournalLine {
  accountId: string
  description: string
  debit: string
  credit: string
}

export default function NewJournalPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<any[]>([])
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    reference: "",
  })
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: "", description: "", debit: "0", credit: "0" },
    { accountId: "", description: "", debit: "0", credit: "0" },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts).catch(console.error)
  }, [])

  function updateLine(index: number, field: keyof JournalLine, value: string) {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    setLines(updated)
  }

  function addLine() {
    setLines([...lines, { accountId: "", description: "", debit: "0", credit: "0" }])
  }

  function removeLine(index: number) {
    if (lines.length > 2) setLines(lines.filter((_, i) => i !== index))
  }

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isBalanced) { setError("القيد غير متوازن - المدين يجب أن يساوي الدائن"); return }
    setLoading(true)
    setError("")

    const res = await fetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, lines }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "حدث خطأ")
      setLoading(false)
    } else {
      router.push("/dashboard/journals")
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/journals"><ArrowRight className="h-4 w-4" /> القيود اليومية</Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>قيد يومية جديد</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} required />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>الوصف</Label>
                <Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="وصف القيد" required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>بنود القيد</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4" /> إضافة سطر
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الحساب</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead className="w-32">مدين (Dr)</TableHead>
                  <TableHead className="w-32">دائن (Cr)</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={line.accountId} onValueChange={(v) => updateLine(i, "accountId", v)}>
                        <SelectTrigger><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} placeholder="وصف" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={line.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} min="0" step="0.01" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={line.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} min="0" step="0.01" />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 border-t pt-4 grid grid-cols-3 gap-4">
              <div />
              <div className={`text-center p-2 rounded font-bold ${isBalanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                مجموع المدين: {totalDebit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
              </div>
              <div className={`text-center p-2 rounded font-bold ${isBalanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                مجموع الدائن: {totalCredit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading || !isBalanced}>
            {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            ترحيل القيد
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/journals")}>
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}

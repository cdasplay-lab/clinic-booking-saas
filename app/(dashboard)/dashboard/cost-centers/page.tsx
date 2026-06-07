"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, Pencil, Trash2, ChevronRight, Layers, Link as LinkIcon } from "lucide-react"
import Link from "next/link"

interface CostCenter {
  id: string
  code: string
  name: string
  parentId: string | null
  isActive: boolean
  parent: { name: string; code: string } | null
}

const EMPTY_FORM = { name: "", code: "", parentId: "" }

export default function CostCentersPage() {
  const [centers, setCenters]   = useState<CostCenter[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")
  const [dialog, setDialog]     = useState<"create" | "edit" | null>(null)
  const [editTarget, setEditTarget] = useState<CostCenter | null>(null)
  const [form, setForm]         = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/cost-centers")
    if (res.ok) setCenters(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditTarget(null)
    setError("")
    setDialog("create")
  }

  function openEdit(cc: CostCenter) {
    setForm({ name: cc.name, code: cc.code, parentId: cc.parentId || "" })
    setEditTarget(cc)
    setError("")
    setDialog("edit")
  }

  async function save() {
    if (!form.name.trim() || !form.code.trim()) { setError("الاسم والرمز مطلوبان"); return }
    setSaving(true)
    setError("")

    const method = dialog === "create" ? "POST" : "PATCH"
    const url    = dialog === "create" ? "/api/cost-centers" : `/api/cost-centers/${editTarget!.id}`

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:     form.name.trim(),
        code:     form.code.trim(),
        parentId: form.parentId || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "حدث خطأ"); setSaving(false); return }

    setDialog(null)
    setSaving(false)
    load()
  }

  async function toggleActive(cc: CostCenter) {
    await fetch(`/api/cost-centers/${cc.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !cc.isActive }),
    })
    load()
  }

  async function remove(cc: CostCenter) {
    if (!confirm(`حذف مركز التكلفة "${cc.name}"؟`)) return
    const res = await fetch(`/api/cost-centers/${cc.id}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) { alert(data.error || "فشل الحذف"); return }
    if (data.deactivated) alert("يحتوي على قيود — تم إلغاء تفعيله بدلاً من الحذف")
    load()
  }

  // Tree: roots first, then children indented
  const roots    = centers.filter((c) => !c.parentId)
  const children = (parentId: string) => centers.filter((c) => c.parentId === parentId)

  function renderRows(list: CostCenter[], depth = 0): JSX.Element[] {
    return list.flatMap((cc) => [
      <TableRow key={cc.id} className={!cc.isActive ? "opacity-50" : ""}>
        <TableCell>
          <span style={{ paddingRight: depth * 20 }} className="flex items-center gap-1">
            {depth > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
            <span className="font-mono text-xs text-gray-500">{cc.code}</span>
          </span>
        </TableCell>
        <TableCell className="font-medium">{cc.name}</TableCell>
        <TableCell className="text-sm text-gray-500">
          {cc.parent ? `${cc.parent.code} — ${cc.parent.name}` : <span className="text-gray-300">—</span>}
        </TableCell>
        <TableCell>
          <Badge className={`text-xs border-0 ${cc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {cc.isActive ? "نشط" : "غير نشط"}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cc)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(cc)}
              title={cc.isActive ? "إلغاء التفعيل" : "تفعيل"}>
              <span className="text-xs">{cc.isActive ? "⏸" : "▶"}</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700"
              onClick={() => remove(cc)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>,
      ...renderRows(children(cc.id), depth + 1),
    ])
  }

  const activeCount = centers.filter((c) => c.isActive).length

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مراكز التكلفة</h1>
          <p className="text-sm text-gray-500">{activeCount} مركز نشط من أصل {centers.length}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/reports/cost-centers">
              <Layers className="h-4 w-4 ml-1" /> تقرير الأداء
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 ml-1" /> مركز جديد
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            هيكل مراكز التكلفة
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 text-xs">
                  <TableHead className="w-32">الرمز</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>المركز الأب</TableHead>
                  <TableHead className="w-24">الحالة</TableHead>
                  <TableHead className="w-32">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {centers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                      <Layers className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      لا توجد مراكز تكلفة بعد — أضف الأول الآن
                    </TableCell>
                  </TableRow>
                ) : (
                  renderRows(roots)
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "إضافة مركز تكلفة" : "تعديل مركز التكلفة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الرمز *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="مثال: CC-01"
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: قسم المبيعات"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>المركز الأب (اختياري)</Label>
              <Select value={form.parentId} onValueChange={(v) => setForm({ ...form, parentId: v })}>
                <SelectTrigger><SelectValue placeholder="مركز رئيسي (بدون أب)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">بدون أب (مركز رئيسي)</SelectItem>
                  {centers
                    .filter((c) => c.id !== editTarget?.id && c.isActive)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              {dialog === "create" ? "إضافة" : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

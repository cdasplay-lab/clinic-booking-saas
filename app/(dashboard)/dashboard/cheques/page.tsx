import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle2, Receipt } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

const STATUS_META: Record<string, { label: string; variant: any }> = {
  PENDING:   { label: "قيد الانتظار", variant: "secondary" },
  DEPOSITED: { label: "برسم التحصيل", variant: "default" },
  CLEARED:   { label: "محصّل",        variant: "success" },
  BOUNCED:   { label: "مرتجع",        variant: "destructive" },
  CANCELLED: { label: "ملغى",         variant: "outline" },
}

export default async function ChequesPage({ searchParams }: { searchParams: { type?: string; status?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const orgId = userOrg.organizationId
  const typeFilter = searchParams.type

  const cheques = await prisma.cheque.findMany({
    where: {
      organizationId: orgId,
      ...(typeFilter ? { type: typeFilter as any } : {}),
    },
    include: { contact: true, bankAccount: true },
    orderBy: { dueDate: "asc" },
  })

  const now = new Date()
  const soon = new Date(now.getTime() + 7 * 86_400_000)

  // Summary metrics
  const incoming = cheques.filter((c) => c.type === "INCOMING")
  const outgoing = cheques.filter((c) => c.type === "OUTGOING")
  const incomingPending = incoming.filter((c) => ["PENDING", "DEPOSITED"].includes(c.status))
  const outgoingPending = outgoing.filter((c) => ["PENDING", "DEPOSITED"].includes(c.status))
  const incomingTotal = incomingPending.reduce((s, c) => s + Number(c.amount), 0)
  const outgoingTotal = outgoingPending.reduce((s, c) => s + Number(c.amount), 0)
  const dueSoon = cheques.filter((c) => ["PENDING", "DEPOSITED"].includes(c.status) && c.dueDate <= soon)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة الشيكات</h1>
          <p className="text-sm text-gray-500">{cheques.length} شيك</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/cheques/new?type=INCOMING">
              <ArrowDownLeft className="h-4 w-4" /> شيك وارد
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/cheques/new?type=OUTGOING">
              <ArrowUpRight className="h-4 w-4" /> شيك صادر
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-500">شيكات واردة (تحت التحصيل)</span>
              <ArrowDownLeft className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(incomingTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">{incomingPending.length} شيك</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-500">شيكات صادرة (آجلة)</span>
              <ArrowUpRight className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(outgoingTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">{outgoingPending.length} شيك</p>
          </CardContent>
        </Card>
        <Card className={dueSoon.length > 0 ? "border-amber-300 bg-amber-50/50" : ""}>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-500">تستحق خلال ٧ أيام</span>
              <AlertTriangle className={`h-4 w-4 ${dueSoon.length > 0 ? "text-amber-500" : "text-gray-300"}`} />
            </div>
            <p className={`text-2xl font-bold ${dueSoon.length > 0 ? "text-amber-600" : "text-gray-400"}`}>{dueSoon.length}</p>
            <p className="text-xs text-gray-400 mt-1">شيك يحتاج متابعة</p>
          </CardContent>
        </Card>
      </div>

      {/* Type filter pills */}
      <div className="flex gap-2">
        {[
          { label: "الكل", value: "" },
          { label: "واردة", value: "INCOMING" },
          { label: "صادرة", value: "OUTGOING" },
        ].map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/dashboard/cheques?type=${f.value}` : "/dashboard/cheques"}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              (typeFilter || "") === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>النوع</TableHead>
              <TableHead>رقم الشيك</TableHead>
              <TableHead>الطرف</TableHead>
              <TableHead>البنك</TableHead>
              <TableHead className="text-left">المبلغ</TableHead>
              <TableHead>الاستحقاق</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cheques.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                  <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  لا توجد شيكات بعد
                </TableCell>
              </TableRow>
            ) : (
              cheques.map((c) => {
                const isIncoming = c.type === "INCOMING"
                const overdue = ["PENDING", "DEPOSITED"].includes(c.status) && c.dueDate < now
                const dueSoonRow = ["PENDING", "DEPOSITED"].includes(c.status) && c.dueDate <= soon && c.dueDate >= now
                const meta = STATUS_META[c.status]
                return (
                  <TableRow key={c.id} className="hover:bg-gray-50">
                    <TableCell>
                      {isIncoming ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                          <ArrowDownLeft className="h-3.5 w-3.5" /> وارد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                          <ArrowUpRight className="h-3.5 w-3.5" /> صادر
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link href={`/dashboard/cheques/${c.id}`} className="text-blue-600 hover:underline">
                        {c.chequeNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{c.partyName}</TableCell>
                    <TableCell className="text-sm text-gray-500">{c.bankName || "—"}</TableCell>
                    <TableCell className="text-left font-bold">{formatCurrency(Number(c.amount))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {(overdue || dueSoonRow) && (
                          <AlertTriangle className={`h-3.5 w-3.5 ${overdue ? "text-red-500" : "text-amber-500"}`} />
                        )}
                        <span className={overdue ? "text-red-600 font-medium" : dueSoonRow ? "text-amber-600" : "text-gray-600"}>
                          {c.dueDate.toLocaleDateString("ar-AE")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

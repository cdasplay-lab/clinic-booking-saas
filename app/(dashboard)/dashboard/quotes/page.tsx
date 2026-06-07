import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, FileText } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const statusConfig: Record<string, { label: string; variant: any }> = {
  DRAFT:     { label: "مسودة",       variant: "secondary" },
  SENT:      { label: "مرسل",        variant: "default" },
  ACCEPTED:  { label: "مقبول",       variant: "success" },
  CONVERTED: { label: "محوّل لفاتورة", variant: "outline" },
  CANCELLED: { label: "ملغى",        variant: "destructive" },
}

export default async function QuotesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const quotes = await prisma.invoice.findMany({
    where: { organizationId: userOrg.organizationId, type: "QUOTE" },
    include: { contact: { select: { name: true } } },
    orderBy: { date: "desc" },
  })

  const totals = {
    draft:     quotes.filter((q) => q.status === "DRAFT").length,
    sent:      quotes.filter((q) => q.status === "SENT").length,
    accepted:  quotes.filter((q) => q.status === "ACCEPTED").length,
    converted: quotes.filter((q) => q.status === "CONVERTED").length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">عروض الأسعار</h1>
          <p className="text-sm text-gray-500">{quotes.length} عرض</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/quotes/new">
            <Plus className="h-4 w-4" />
            عرض سعر جديد
          </Link>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "مسودات", count: totals.draft,     color: "text-gray-600" },
          { label: "مرسلة",  count: totals.sent,      color: "text-blue-600" },
          { label: "مقبولة", count: totals.accepted,  color: "text-green-600" },
          { label: "محوّلة", count: totals.converted, color: "text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم العرض</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>صالح حتى</TableHead>
              <TableHead className="text-left">الإجمالي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  لا توجد عروض أسعار بعد
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((q) => {
                const cfg = statusConfig[q.status] || { label: q.status, variant: "outline" }
                const isExpired = q.dueDate < new Date() && ["DRAFT", "SENT"].includes(q.status)
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono font-medium">{q.number}</TableCell>
                    <TableCell>{q.contact.name}</TableCell>
                    <TableCell>{formatDateShort(q.date)}</TableCell>
                    <TableCell className={isExpired ? "text-red-600 font-medium" : ""}>
                      {formatDateShort(q.dueDate)}
                      {isExpired && <span className="text-xs mr-1">(منتهي)</span>}
                    </TableCell>
                    <TableCell className="text-left">{formatCurrency(Number(q.total))}</TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/quotes/${q.id}`}>عرض</Link>
                      </Button>
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

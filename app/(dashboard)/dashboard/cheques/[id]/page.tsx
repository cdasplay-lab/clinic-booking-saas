import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, ArrowDownLeft, ArrowUpRight, Calendar, Building2, User, Receipt } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import ChequeActions from "@/components/cheques/cheque-actions"

const STATUS_META: Record<string, { label: string; variant: any }> = {
  PENDING:   { label: "قيد الانتظار", variant: "secondary" },
  DEPOSITED: { label: "برسم التحصيل", variant: "default" },
  CLEARED:   { label: "محصّل",        variant: "success" },
  BOUNCED:   { label: "مرتجع",        variant: "destructive" },
  CANCELLED: { label: "ملغى",         variant: "outline" },
}

export default async function ChequeDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const cheque = await prisma.cheque.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { contact: true, bankAccount: true },
  })
  if (!cheque) notFound()

  const isIncoming = cheque.type === "INCOMING"
  const meta = STATUS_META[cheque.status]

  // Pull related journals for the audit trail
  const journalIds = [cheque.recordJournalId, cheque.clearJournalId].filter(Boolean) as string[]
  const journals = journalIds.length
    ? await prisma.journal.findMany({ where: { id: { in: journalIds } }, include: { lines: { include: { account: true } } } })
    : []

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/cheques"><ArrowRight className="h-4 w-4" /> الشيكات</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIncoming ? "bg-green-100" : "bg-red-100"}`}>
                {isIncoming ? <ArrowDownLeft className="h-5 w-5 text-green-600" /> : <ArrowUpRight className="h-5 w-5 text-red-600" />}
              </div>
              <div>
                <CardTitle className="font-mono">شيك #{cheque.chequeNumber}</CardTitle>
                <p className="text-sm text-gray-500">{isIncoming ? "وارد من عميل" : "صادر لمورد"}</p>
              </div>
            </div>
            <Badge variant={meta.variant} className="text-sm">{meta.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">المبلغ</p>
            <p className="text-3xl font-bold">{formatCurrency(Number(cheque.amount))}</p>
            <p className="text-xs text-gray-400 mt-1">{cheque.currency}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-400 text-xs">{isIncoming ? "الساحب" : "المستفيد"}</p>
                <p className="font-medium">{cheque.partyName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-400 text-xs">البنك</p>
                <p className="font-medium">{cheque.bankName || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-400 text-xs">تاريخ الإصدار</p>
                <p className="font-medium">{cheque.issueDate.toLocaleDateString("ar-AE")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-400" />
              <div>
                <p className="text-gray-400 text-xs">تاريخ الاستحقاق</p>
                <p className="font-medium">{cheque.dueDate.toLocaleDateString("ar-AE")}</p>
              </div>
            </div>
            {cheque.contact && (
              <div className="flex items-center gap-2 col-span-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-gray-400 text-xs">جهة الاتصال المرتبطة</p>
                  <p className="font-medium">{cheque.contact.name}</p>
                </div>
              </div>
            )}
          </div>

          {cheque.notes && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{cheque.notes}</div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">الإجراءات</CardTitle></CardHeader>
        <CardContent>
          <ChequeActions chequeId={cheque.id} status={cheque.status} type={cheque.type} />
        </CardContent>
      </Card>

      {/* Accounting trail */}
      {journals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> القيود المحاسبية</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {journals.map((j) => (
              <div key={j.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-blue-600">{j.number}</span>
                  <span className="text-xs text-gray-400">{j.date.toLocaleDateString("ar-AE")}</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{j.description}</p>
                <div className="space-y-1">
                  {j.lines.map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{l.account.name}</span>
                      <span className={Number(l.debit) > 0 ? "text-green-600" : "text-red-600"}>
                        {Number(l.debit) > 0 ? `مدين ${formatCurrency(Number(l.debit))}` : `دائن ${formatCurrency(Number(l.credit))}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

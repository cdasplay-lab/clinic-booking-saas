import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MessageCircle, CheckCircle2, XCircle, Clock, Zap, Settings } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import Link from "next/link"

export default async function WhatsAppPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const orgId = userOrg.organizationId

  const [whatsappInt, pendingTxs, stats] = await Promise.all([
    prisma.whatsAppIntegration.findFirst({ where: { organizationId: orgId } }),
    prisma.pendingTransaction.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.pendingTransaction.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: true,
    }),
  ])

  const statsMap = stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {} as Record<string, number>)

  const typeLabels: Record<string, { label: string; color: string }> = {
    INVOICE: { label: "مبيعات", color: "bg-green-100 text-green-700" },
    BILL: { label: "مشتريات", color: "bg-blue-100 text-blue-700" },
    PAYMENT: { label: "دفعة", color: "bg-purple-100 text-purple-700" },
    EXPENSE: { label: "مصروف", color: "bg-orange-100 text-orange-700" },
    JOURNAL: { label: "قيد", color: "bg-gray-100 text-gray-700" },
  }

  const statusConfig: Record<string, { label: string; icon: any; variant: any }> = {
    WAITING: { label: "بانتظار التأكيد", icon: Clock, variant: "warning" },
    CONFIRMED: { label: "تم التأكيد", icon: CheckCircle2, variant: "success" },
    POSTED: { label: "مرحّل", icon: CheckCircle2, variant: "success" },
    REJECTED: { label: "مرفوض", icon: XCircle, variant: "destructive" },
    FAILED: { label: "فشل", icon: XCircle, variant: "destructive" },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-500" />
            تكامل واتساب
          </h1>
          <p className="text-sm text-gray-500">سجّل العمليات المالية مباشرة من مجموعة واتساب</p>
        </div>
        {whatsappInt && (
          <Badge className={whatsappInt.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
            {whatsappInt.isActive ? "✓ متصل" : "غير متصل"}
          </Badge>
        )}
      </div>

      {/* How it works */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-6">
          <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5" /> كيف يعمل النظام
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: "1", title: "أرسل رسالة", desc: "\"اشترينا بضاعة من علي 5000 ريال\"", icon: "💬" },
              { step: "2", title: "AI يفهم", desc: "يستخرج: نوع، مبلغ، طرف، تاريخ", icon: "🤖" },
              { step: "3", title: "يطلب التأكيد", desc: "يرسل تفاصيل العملية للمراجعة", icon: "✋" },
              { step: "4", title: "تأكيد ← تسجيل", desc: "ترد \"تأكيد\" فيُسجَّل تلقائياً", icon: "✅" },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-3xl mb-2">{s.icon}</div>
                <p className="font-bold text-green-800 text-sm">{s.step}. {s.title}</p>
                <p className="text-xs text-green-600 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">بانتظار التأكيد</p>
            <p className="text-2xl font-bold text-orange-600">{statsMap["WAITING"] || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">تم التسجيل</p>
            <p className="text-2xl font-bold text-green-600">{statsMap["POSTED"] || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">مرفوضة</p>
            <p className="text-2xl font-bold text-red-600">{statsMap["REJECTED"] || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">إجمالي العمليات</p>
            <p className="text-2xl font-bold">{pendingTxs.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Setup */}
      {!whatsappInt && (
        <Card className="border-dashed border-2 border-green-300">
          <CardContent className="p-8 text-center">
            <MessageCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">ربط واتساب بيزنس</h3>
            <p className="text-gray-500 text-sm mb-4">
              اربط حساب WhatsApp Business الخاص بك لبدء تسجيل العمليات المالية تلقائياً
            </p>
            <Button asChild>
              <Link href="/dashboard/whatsapp/setup">
                <Settings className="h-4 w-4" /> إعداد الاتصال
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>سجل العمليات من واتساب</CardTitle>
            {pendingTxs.filter((t) => t.status === "WAITING").length > 0 && (
              <Badge variant="destructive">
                {pendingTxs.filter((t) => t.status === "WAITING").length} تنتظر تأكيد
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendingTxs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>لا توجد عمليات واردة من واتساب بعد</p>
              <p className="text-xs mt-1">أرسل رسالة مالية من المجموعة لتبدأ</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المرسل</TableHead>
                  <TableHead>الرسالة</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead className="text-left">المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTxs.map((tx) => {
                  const parsed = tx.parsedData as any
                  const statusConf = statusConfig[tx.status] || statusConfig.WAITING
                  const typeConf = typeLabels[parsed?.type] || { label: "أخرى", color: "bg-gray-100 text-gray-700" }

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">{formatDateShort(tx.createdAt)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{tx.senderName || "مجهول"}</p>
                          <p className="text-xs text-gray-400 font-mono">{tx.senderPhone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm max-w-xs truncate" title={tx.originalMessage}>
                          {tx.originalMessage}
                        </p>
                        {parsed?.arabicSummary && (
                          <p className="text-xs text-gray-400 truncate">{parsed.arabicSummary}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${typeConf.color}`}>
                          {typeConf.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-left font-medium">
                        {parsed?.amount ? formatCurrency(parsed.amount) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <statusConf.icon className={`h-4 w-4 ${
                            tx.status === "POSTED" ? "text-green-500" :
                            tx.status === "WAITING" ? "text-orange-500" :
                            tx.status === "REJECTED" || tx.status === "FAILED" ? "text-red-500" : "text-gray-400"
                          }`} />
                          <span className="text-xs">{statusConf.label}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

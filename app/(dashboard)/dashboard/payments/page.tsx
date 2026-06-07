import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, CreditCard } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"

export default async function PaymentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const payments = await prisma.payment.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: true },
    orderBy: { date: "desc" },
  })

  const methodLabels: Record<string, string> = {
    CASH: "نقداً",
    BANK_TRANSFER: "تحويل بنكي",
    CHECK: "شيك",
    CREDIT_CARD: "بطاقة ائتمان",
    ONLINE: "دفع إلكتروني",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المدفوعات</h1>
          <p className="text-sm text-gray-500">{payments.length} دفعة</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/payments/new">
            <Plus className="h-4 w-4" />
            دفعة جديدة
          </Link>
        </Button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>الطرف</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>المرجع</TableHead>
              <TableHead className="text-left">المبلغ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={CreditCard}
                    title="لا توجد مدفوعات بعد"
                    description="سجّل دفعة واردة من عميل أو دفعة صادرة لمورد لتتبع تدفقاتك المالية"
                    href="/dashboard/payments/new"
                    ctaLabel="تسجيل دفعة"
                  />
                </TableCell>
              </TableRow>
            )}
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{formatDateShort(p.date)}</TableCell>
                <TableCell>{p.contact?.name || "-"}</TableCell>
                <TableCell>
                  <Badge variant={p.type === "INCOMING" ? "success" : "destructive"}>
                    {p.type === "INCOMING" ? "وارد" : "صادر"}
                  </Badge>
                </TableCell>
                <TableCell>{methodLabels[p.method] || p.method}</TableCell>
                <TableCell className="font-mono text-sm">{p.reference || "-"}</TableCell>
                <TableCell className={`text-left font-medium ${p.type === "INCOMING" ? "text-green-600" : "text-red-600"}`}>
                  {p.type === "INCOMING" ? "+" : "-"}{formatCurrency(Number(p.amount))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

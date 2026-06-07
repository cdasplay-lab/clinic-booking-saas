import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatDateShort } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Shield, User, Clock } from "lucide-react"

const actionConfig: Record<string, { label: string; color: string }> = {
  CREATE:  { label: "إنشاء",    color: "bg-green-100 text-green-700" },
  UPDATE:  { label: "تعديل",   color: "bg-blue-100 text-blue-700" },
  DELETE:  { label: "حذف",     color: "bg-red-100 text-red-700" },
  SEND:    { label: "إرسال",   color: "bg-purple-100 text-purple-700" },
  POST:    { label: "ترحيل",   color: "bg-indigo-100 text-indigo-700" },
  CANCEL:  { label: "إلغاء",   color: "bg-orange-100 text-orange-700" },
  PAY:     { label: "دفع",     color: "bg-teal-100 text-teal-700" },
  LOGIN:   { label: "دخول",    color: "bg-gray-100 text-gray-700" },
  IMPORT:  { label: "استيراد", color: "bg-yellow-100 text-yellow-700" },
  EXPORT:  { label: "تصدير",   color: "bg-cyan-100 text-cyan-700" },
}

const entityTypeLabels: Record<string, string> = {
  INVOICE:    "فاتورة",
  BILL:       "فاتورة مورد",
  JOURNAL:    "قيد يومي",
  CONTACT:    "جهة اتصال",
  PRODUCT:    "منتج",
  PAYMENT:    "دفعة",
  SETTINGS:   "الإعدادات",
  USER:       "مستخدم",
  ATTACHMENT: "مرفق",
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { page?: string; entityType?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  if (!["OWNER", "ADMIN"].includes(userOrg.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Shield className="h-12 w-12 mb-4 text-gray-300" />
        <p className="font-medium">سجل التدقيق متاح للمالك والمدير فقط</p>
      </div>
    )
  }

  const page      = Math.max(1, Number(searchParams.page || 1))
  const take      = 50
  const entityType = searchParams.entityType || undefined

  const where = {
    organizationId: userOrg.organizationId,
    ...(entityType ? { entityType } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.auditLog.count({ where }),
  ])

  const pages = Math.ceil(total / take)

  const filters = [
    { label: "الكل", value: "" },
    { label: "الفواتير", value: "INVOICE" },
    { label: "فواتير الموردين", value: "BILL" },
    { label: "القيود", value: "JOURNAL" },
    { label: "جهات الاتصال", value: "CONTACT" },
    { label: "الدفعات", value: "PAYMENT" },
    { label: "الإعدادات", value: "SETTINGS" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            سجل التدقيق
          </h1>
          <p className="text-sm text-gray-500">{total} إجراء مسجّل</p>
        </div>
      </div>

      {/* Entity type filter */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <a
            key={f.value}
            href={f.value ? `/dashboard/audit?entityType=${f.value}` : "/dashboard/audit"}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              (entityType || "") === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-36">الوقت</TableHead>
                <TableHead className="w-28">الإجراء</TableHead>
                <TableHead>الكيان</TableHead>
                <TableHead>التفاصيل</TableHead>
                <TableHead className="w-36">المستخدم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    لا توجد سجلات بعد
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const action = actionConfig[log.action] || { label: log.action, color: "bg-gray-100 text-gray-600" }
                  const changes = log.changes as Record<string, [unknown, unknown]> | null

                  return (
                    <TableRow key={log.id} className="text-sm">
                      <TableCell className="text-gray-500 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("ar-SA", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${action.color}`}>
                          {action.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-gray-400 text-xs">{entityTypeLabels[log.entityType] || log.entityType}</span>
                          {log.entityLabel && (
                            <p className="font-medium font-mono text-xs">{log.entityLabel}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600 text-xs max-w-xs">
                        {changes && Object.keys(changes).length > 0 ? (
                          <div className="space-y-0.5">
                            {Object.entries(changes).slice(0, 3).map(([field, [from, to]]) => (
                              <div key={field}>
                                <span className="text-gray-400">{field}:</span>{" "}
                                {from !== null && from !== undefined && String(from) !== "" && (
                                  <span className="line-through text-red-400">{String(from).slice(0, 20)}</span>
                                )}
                                {from !== null && from !== undefined && String(from) !== "" && " → "}
                                <span className="text-green-700">{String(to).slice(0, 20)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <User className="h-3 w-3 text-blue-600" />
                          </div>
                          <span className="text-xs text-gray-600 truncate max-w-[100px]">{log.userName}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <a
              href={`/dashboard/audit?page=${page - 1}${entityType ? `&entityType=${entityType}` : ""}`}
              className="px-3 py-1 rounded border text-sm hover:bg-gray-50"
            >
              السابق
            </a>
          )}
          <span className="text-sm text-gray-500">صفحة {page} من {pages}</span>
          {page < pages && (
            <a
              href={`/dashboard/audit?page=${page + 1}${entityType ? `&entityType=${entityType}` : ""}`}
              className="px-3 py-1 rounded border text-sm hover:bg-gray-50"
            >
              التالي
            </a>
          )}
        </div>
      )}
    </div>
  )
}

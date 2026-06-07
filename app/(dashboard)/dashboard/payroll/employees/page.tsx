import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Users } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"
import { DeactivateEmployeeButton } from "@/components/payroll/deactivate-employee-button"

export default async function EmployeesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const employees = await prisma.employee.findMany({
    where: { organizationId: userOrg.organizationId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  })

  const active   = employees.filter((e) => e.isActive).length
  const inactive = employees.filter((e) => !e.isActive).length
  const totalPayroll = employees
    .filter((e) => e.isActive)
    .reduce((s, e) => s + Number(e.basicSalary), 0)

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="لا يوجد موظفون بعد"
        description="أضف موظفين لتشغيل كشوف الرواتب وتتبع الأجور"
        href="/dashboard/payroll/employees/new"
        ctaLabel="إضافة موظف"
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الموظفون</h1>
          <p className="text-sm text-gray-500">{active} نشط · {inactive} غير نشط</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/payroll/employees/new">
            <Plus className="h-4 w-4" /> موظف جديد
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">موظفون نشطون</p>
          <p className="text-xl font-bold">{active}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">إجمالي رواتب شهرية</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totalPayroll)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">متوسط الراتب</p>
          <p className="text-xl font-bold">{formatCurrency(active > 0 ? totalPayroll / active : 0)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>كود</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>القسم</TableHead>
              <TableHead>المسمى</TableHead>
              <TableHead>تاريخ الالتحاق</TableHead>
              <TableHead className="text-left">الراتب الأساسي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id} className={`hover:bg-gray-50 ${!emp.isActive ? "opacity-50" : ""}`}>
                <TableCell className="font-mono text-sm">{emp.employeeId}</TableCell>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell className="text-gray-500 text-sm">{emp.department || "—"}</TableCell>
                <TableCell className="text-gray-500 text-sm">{emp.position || "—"}</TableCell>
                <TableCell className="text-gray-500 text-sm">{formatDateShort(emp.joinDate)}</TableCell>
                <TableCell className="text-left font-medium">{formatCurrency(Number(emp.basicSalary))}</TableCell>
                <TableCell>
                  <Badge variant={emp.isActive ? "success" : "secondary"}>
                    {emp.isActive ? "نشط" : "غير نشط"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {emp.isActive && (
                    <DeactivateEmployeeButton employeeId={emp.id} employeeName={emp.name} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

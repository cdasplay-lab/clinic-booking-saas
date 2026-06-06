import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default async function PayrollPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) redirect("/onboarding")

  const [employees, payrollRuns] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId: userOrg.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.payrollRun.findMany({
      where: { organizationId: userOrg.organizationId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ])

  const totalPayroll = employees.reduce((s, e) => s + Number(e.basicSalary), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الرواتب والأجور</h1>
          <p className="text-sm text-gray-500">{employees.length} موظف</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/payroll/employees/new">
              <Plus className="h-4 w-4" />
              موظف جديد
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/payroll/run">
              تشغيل كشف الرواتب
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">إجمالي الرواتب الشهرية</p>
            <p className="text-2xl font-bold">{formatCurrency(totalPayroll)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">عدد الموظفين</p>
            <p className="text-2xl font-bold">{employees.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">متوسط الراتب</p>
            <p className="text-2xl font-bold">{formatCurrency(employees.length > 0 ? totalPayroll / employees.length : 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>الموظفون</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {employees.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                لا يوجد موظفون بعد
              </div>
            ) : (
              employees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-sm text-gray-500">{emp.department} · {emp.position}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{formatCurrency(Number(emp.basicSalary))}</p>
                    <p className="text-xs text-gray-400">شهرياً</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

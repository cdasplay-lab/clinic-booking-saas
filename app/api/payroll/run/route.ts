import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createJournalEntry, round2 } from "@/lib/accounting"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const runs = await prisma.payrollRun.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { payslips: { include: { employee: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 12,
  })

  return NextResponse.json(runs)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const { period, startDate, endDate, payDate, employeeIds } = await req.json()

  if (!period || !startDate || !endDate || !payDate) {
    return NextResponse.json({ error: "الفترة وتواريخ كشف الرواتب مطلوبة" }, { status: 400 })
  }

  const employees = await prisma.employee.findMany({
    where: {
      organizationId: userOrg.organizationId,
      isActive: true,
      ...(employeeIds?.length ? { id: { in: employeeIds } } : {}),
    },
  })

  if (employees.length === 0) {
    return NextResponse.json({ error: "لا يوجد موظفون نشطون" }, { status: 400 })
  }

  const totalGross = employees.reduce((s, e) => s + Number(e.basicSalary), 0)

  const run = await prisma.payrollRun.create({
    data: {
      organizationId: userOrg.organizationId,
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      payDate: new Date(payDate),
      totalGross,
      totalNet: totalGross,
      payslips: {
        create: employees.map((e) => ({
          employeeId: e.id,
          basicSalary: Number(e.basicSalary),
          grossSalary: Number(e.basicSalary),
          netSalary:   Number(e.basicSalary),
        })),
      },
    },
    include: { payslips: { include: { employee: { select: { name: true } } } } },
  })

  // Journal entry: DR Salaries Expense, CR Cash/Bank
  const payDateObj = new Date(payDate)
  const [salaryAccount, bankAccount] = await Promise.all([
    prisma.account.findFirst({
      where: { organizationId: userOrg.organizationId, accountType: "EXPENSE" },
      orderBy: { code: "asc" },
    }),
    prisma.account.findFirst({
      where: { organizationId: userOrg.organizationId, accountType: { in: ["BANK", "CASH"] } },
      orderBy: { code: "asc" },
    }),
  ])

  if (salaryAccount && bankAccount) {
    const total = round2(totalGross)
    await createJournalEntry({
      organizationId: userOrg.organizationId,
      date:        payDateObj,
      type:        "PAYROLL",
      description: `رواتب ${period}`,
      sourceType:  "payroll",
      sourceId:    run.id,
      lines: [
        { accountId: salaryAccount.id, debit: total, credit: 0, description: `رواتب ${period}` },
        { accountId: bankAccount.id,   debit: 0, credit: total, description: `صرف رواتب ${period}` },
      ],
    })
  }

  return NextResponse.json(run, { status: 201 })
}

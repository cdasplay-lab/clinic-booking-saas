import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const employees = await prisma.employee.findMany({
    where: { organizationId: userOrg.organizationId },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(employees)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const { name, employeeId, email, phone, department, position, basicSalary, joinDate, commissionRate } = await req.json()

  if (!name || !basicSalary || !joinDate) {
    return NextResponse.json({ error: "الاسم والراتب وتاريخ الالتحاق مطلوبة" }, { status: 400 })
  }

  // Auto-generate employeeId if not provided
  let empId = employeeId
  if (!empId) {
    const count = await prisma.employee.count({ where: { organizationId: userOrg.organizationId } })
    empId = `EMP-${String(count + 1).padStart(4, "0")}`
  }

  const employee = await prisma.employee.create({
    data: {
      organizationId: userOrg.organizationId,
      employeeId: empId,
      name,
      email: email || null,
      phone: phone || null,
      department: department || null,
      position: position || null,
      basicSalary: Number(basicSalary),
      joinDate: new Date(joinDate),
      commissionRate: commissionRate !== undefined && commissionRate !== "" ? Number(commissionRate) : null,
    },
  })

  return NextResponse.json(employee, { status: 201 })
}

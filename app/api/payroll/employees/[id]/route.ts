import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const emp = await prisma.employee.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!emp) return NextResponse.json({ error: "موظف غير موجود" }, { status: 404 })

  const data = await req.json()

  const updated = await prisma.employee.update({
    where: { id: params.id },
    data: {
      name:        data.name        ?? emp.name,
      email:       data.email       ?? emp.email,
      phone:       data.phone       ?? emp.phone,
      department:  data.department  ?? emp.department,
      position:    data.position    ?? emp.position,
      basicSalary: data.basicSalary !== undefined ? Number(data.basicSalary) : emp.basicSalary,
      isActive:    data.isActive    !== undefined ? data.isActive : emp.isActive,
      endDate:     data.endDate     ? new Date(data.endDate) : emp.endDate,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  // Soft delete — mark inactive + set end date
  await prisma.employee.update({
    where: { id: params.id },
    data: { isActive: false, endDate: new Date() },
  })

  return NextResponse.json({ success: true })
}

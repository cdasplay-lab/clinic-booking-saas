import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManage, canChangeRole, type OrgRole } from "@/lib/permissions"

// PATCH — change role
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actor = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!actor) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const target = await prisma.userOrganization.findFirst({
    where: { id: params.id, organizationId: actor.organizationId },
  })
  if (!target) return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 })
  if (target.role === "OWNER") return NextResponse.json({ error: "لا يمكن تغيير دور المالك" }, { status: 403 })
  if (target.userId === session.user.id) return NextResponse.json({ error: "لا يمكنك تغيير دورك بنفسك" }, { status: 403 })

  const { role } = await req.json()
  if (!canChangeRole(actor.role as OrgRole, role as OrgRole)) {
    return NextResponse.json({ error: "لا يمكنك منح هذا الدور" }, { status: 403 })
  }

  const updated = await prisma.userOrganization.update({
    where: { id: params.id },
    data: { role },
    include: { user: { select: { name: true, email: true } } },
  })

  return NextResponse.json(updated)
}

// DELETE — remove member
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actor = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!actor) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const target = await prisma.userOrganization.findFirst({
    where: { id: params.id, organizationId: actor.organizationId },
  })
  if (!target) return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 })
  if (target.role === "OWNER") return NextResponse.json({ error: "لا يمكن إزالة المالك" }, { status: 403 })
  if (target.userId === session.user.id) return NextResponse.json({ error: "لا يمكنك إزالة نفسك" }, { status: 403 })

  if (!canManage(actor.role as OrgRole, target.role as OrgRole)) {
    return NextResponse.json({ error: "لا يمكنك إزالة هذا العضو" }, { status: 403 })
  }

  await prisma.userOrganization.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

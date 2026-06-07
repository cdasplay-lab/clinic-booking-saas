import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const center = await prisma.costCenter.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!center) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const { name, code, parentId, isActive } = body

  // Check code uniqueness if changing
  if (code && code !== center.code) {
    const dup = await prisma.costCenter.findFirst({
      where: { organizationId: userOrg.organizationId, code: code.trim(), id: { not: params.id } },
    })
    if (dup) return NextResponse.json({ error: "رمز مركز التكلفة مستخدم مسبقاً" }, { status: 400 })
  }

  // Prevent setting own ID as parent
  if (parentId === params.id) {
    return NextResponse.json({ error: "لا يمكن أن يكون مركز التكلفة تابعاً لنفسه" }, { status: 400 })
  }

  const updated = await prisma.costCenter.update({
    where: { id: params.id },
    data: {
      ...(name      !== undefined && { name:     name.trim() }),
      ...(code      !== undefined && { code:     code.trim() }),
      ...(parentId  !== undefined && { parentId: parentId || null }),
      ...(isActive  !== undefined && { isActive: Boolean(isActive) }),
    },
    include: { parent: { select: { id: true, name: true, code: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const center = await prisma.costCenter.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { _count: { select: { journalLines: true, children: true } } },
  })
  if (!center) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (center._count.journalLines > 0) {
    // Has journal lines — deactivate instead of delete
    await prisma.costCenter.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json({ deactivated: true })
  }

  if (center._count.children > 0) {
    return NextResponse.json({ error: "يحتوي على مراكز فرعية — احذفها أولاً" }, { status: 400 })
  }

  await prisma.costCenter.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}

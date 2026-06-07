import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const centers = await prisma.costCenter.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { parent: { select: { id: true, name: true, code: true } } },
    orderBy: [{ code: "asc" }],
  })

  return NextResponse.json(centers)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const { name, code, parentId } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 })
  if (!code?.trim()) return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 })

  const orgId = userOrg.organizationId

  // Check unique code within org
  const existing = await prisma.costCenter.findFirst({
    where: { organizationId: orgId, code: code.trim() },
  })
  if (existing) return NextResponse.json({ error: "رمز مركز التكلفة مستخدم مسبقاً" }, { status: 400 })

  const center = await prisma.costCenter.create({
    data: {
      organizationId: orgId,
      name: name.trim(),
      code: code.trim(),
      parentId: parentId || null,
      isActive: true,
    },
    include: { parent: { select: { id: true, name: true, code: true } } },
  })

  return NextResponse.json(center, { status: 201 })
}

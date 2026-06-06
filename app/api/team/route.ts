import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canChangeRole, type OrgRole } from "@/lib/permissions"
import bcrypt from "bcryptjs"

// GET — list all members of the current org
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const members = await prisma.userOrganization.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(members)
}

// POST — invite a user by email (add existing or create new)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actor = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!actor) return NextResponse.json({ error: "ليس لديك صلاحية دعوة أعضاء" }, { status: 403 })

  const { email, role = "VIEWER", name } = await req.json()
  if (!email) return NextResponse.json({ error: "البريد الإلكتروني مطلوب" }, { status: 400 })

  // Validate role
  if (!canChangeRole(actor.role as OrgRole, role as OrgRole)) {
    return NextResponse.json({ error: "لا يمكنك منح هذا الدور" }, { status: 403 })
  }

  // Check if already a member
  const existingMembership = await prisma.userOrganization.findFirst({
    where: {
      organizationId: actor.organizationId,
      user: { email },
    },
  })
  if (existingMembership) {
    return NextResponse.json({ error: "هذا المستخدم عضو بالفعل" }, { status: 400 })
  }

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email } })
  let tempPassword: string | null = null

  if (!user) {
    // Create new user with temp password
    tempPassword = Math.random().toString(36).slice(-8).toUpperCase()
    const hashed = await bcrypt.hash(tempPassword, 12)
    user = await prisma.user.create({
      data: { name: name || email.split("@")[0], email, password: hashed },
    })
  }

  await prisma.userOrganization.create({
    data: {
      userId: user.id,
      organizationId: actor.organizationId,
      role: role as any,
      isDefault: true,
    },
  })

  return NextResponse.json({
    success: true,
    isNewUser: !!tempPassword,
    tempPassword,
    message: tempPassword
      ? `تم إنشاء حساب جديد. كلمة المرور المؤقتة: ${tempPassword}`
      : "تمت إضافة المستخدم للمنظمة",
  })
}

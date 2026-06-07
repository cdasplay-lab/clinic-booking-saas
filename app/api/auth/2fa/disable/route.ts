import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { verifyTotp } from "@/lib/two-factor"
import bcrypt from "bcryptjs"
import { writeAuditLog } from "@/lib/audit"

// POST — disable 2FA (requires current TOTP code + password)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { token, password } = await req.json()

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!user.twoFactorEnabled) return NextResponse.json({ error: "المصادقة الثنائية غير مفعّلة" }, { status: 400 })

  // Verify password
  if (password && user.password) {
    const pwValid = await bcrypt.compare(password, user.password)
    if (!pwValid) return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 400 })
  }

  // Verify TOTP
  if (!token || !user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, token.trim())) {
    return NextResponse.json({ error: "رمز المصادقة غير صحيح" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  })

  await writeAuditLog({
    organizationId: (await prisma.userOrganization.findFirst({ where: { userId: user.id, isDefault: true } }))?.organizationId || "none",
    userId: user.id,
    userName: user.name || user.email || "",
    action: "UPDATE",
    entityType: "USER",
    entityId: user.id,
    entityLabel: "إلغاء المصادقة الثنائية",
    ipAddress: req.headers.get("x-forwarded-for") || undefined,
  })

  return NextResponse.json({ success: true })
}

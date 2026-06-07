import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { verifyTotp } from "@/lib/two-factor"
import { writeAuditLog } from "@/lib/audit"

// POST — verify code during setup to activate 2FA
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || !user.twoFactorSecret) {
    return NextResponse.json({ error: "لا يوجد إعداد 2FA معلّق" }, { status: 400 })
  }

  const valid = verifyTotp(user.twoFactorSecret, token.trim())
  if (!valid) {
    return NextResponse.json({ error: "الرمز غير صحيح أو منتهي الصلاحية" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true },
  })

  await writeAuditLog({
    organizationId: (await prisma.userOrganization.findFirst({ where: { userId: user.id, isDefault: true } }))?.organizationId || "none",
    userId: user.id,
    userName: user.name || user.email || "",
    action: "UPDATE",
    entityType: "USER",
    entityId: user.id,
    entityLabel: "تفعيل المصادقة الثنائية",
    ipAddress: req.headers.get("x-forwarded-for") || undefined,
  })

  return NextResponse.json({ success: true })
}

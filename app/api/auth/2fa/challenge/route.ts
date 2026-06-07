import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { verifyTotp } from "@/lib/two-factor"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: "2FA not configured" }, { status: 400 })
  }

  if (!verifyTotp(user.twoFactorSecret, token.trim())) {
    return NextResponse.json({ error: "الرمز غير صحيح أو منتهي الصلاحية" }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set("2fa_ok", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })
  return response
}

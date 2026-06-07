import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, email, currentPassword, newPassword } = await req.json()

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const updates: Record<string, any> = {}

  if (name && name !== user.name) {
    if (name.trim().length < 2) return NextResponse.json({ error: "الاسم قصير جداً" }, { status: 400 })
    updates.name = name.trim()
  }

  if (email && email !== user.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return NextResponse.json({ error: "البريد الإلكتروني غير صحيح" }, { status: 400 })
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 400 })
    updates.email = email.toLowerCase().trim()
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "كلمة المرور الحالية مطلوبة" }, { status: 400 })
    }
    const valid = await bcrypt.compare(currentPassword, user.password || "")
    if (!valid) return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 })
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }, { status: 400 })
    }
    updates.password = await bcrypt.hash(newPassword, 12)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "لا توجد تغييرات" })
  }

  await prisma.user.update({ where: { id: session.user.id }, data: updates })
  return NextResponse.json({ success: true })
}

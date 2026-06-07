import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateTotpSecret, generateQrDataUrl } from "@/lib/two-factor"

// GET — generate new secret + QR (not yet activated)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "المصادقة الثنائية مفعّلة مسبقاً" }, { status: 400 })
  }

  // Generate a pending secret (stored in DB but not yet enabled)
  const secret = generateTotpSecret()
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret }, // stored but twoFactorEnabled = false
  })

  const qrDataUrl = await generateQrDataUrl(user.email!, secret)

  return NextResponse.json({ secret, qrDataUrl })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const { phoneNumberId, accessToken, webhookVerifyToken } = await req.json()

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json({ error: "Phone Number ID و Access Token مطلوبان" }, { status: 400 })
  }

  const integration = await prisma.whatsAppIntegration.upsert({
    where: { organizationId: userOrg.organizationId },
    create: {
      organizationId: userOrg.organizationId,
      phoneNumberId,
      accessToken,
      webhookVerifyToken: webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "hesabpro",
      isActive: true,
    },
    update: {
      phoneNumberId,
      accessToken,
      webhookVerifyToken: webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "hesabpro",
      isActive: true,
    },
  })

  return NextResponse.json({ success: true, id: integration.id })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json(null)

  const integration = await prisma.whatsAppIntegration.findFirst({
    where: { organizationId: userOrg.organizationId },
    select: { id: true, isActive: true, phoneNumberId: true, createdAt: true },
  })

  return NextResponse.json(integration)
}

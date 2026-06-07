import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const { stripeCustomerId } = userOrg.organization
  if (!stripeCustomerId) return NextResponse.json({ error: "No active subscription" }, { status: 400 })

  const appUrl   = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: `${appUrl}/dashboard/billing`,
  })

  return NextResponse.json({ url: portalSession.url })
}

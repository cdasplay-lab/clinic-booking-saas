import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe, PLAN_PRICE_IDS } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const { planId } = await req.json()
  const priceId = PLAN_PRICE_IDS[planId as string]
  if (!priceId) return NextResponse.json({ error: "Invalid plan" }, { status: 400 })

  const org = userOrg.organization

  // Get or create Stripe customer
  let customerId = org.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      name:     org.name,
      email:    org.email || session.user.email || undefined,
      metadata: { orgId: org.id },
    })
    customerId = customer.id
    await prisma.organization.update({
      where: { id: org.id },
      data:  { stripeCustomerId: customerId },
    })
  }

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  const checkoutSession = await stripe.checkout.sessions.create({
    customer:            customerId,
    mode:                "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url:  `${appUrl}/dashboard/billing?cancelled=1`,
    metadata:    { orgId: org.id, planId },
    subscription_data: {
      metadata:            { orgId: org.id, planId },
      // Give a 14-day free trial only if the org is still within its trial window
      trial_period_days:   org.trialEndsAt && new Date(org.trialEndsAt) > new Date() ? 14 : undefined,
    },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}

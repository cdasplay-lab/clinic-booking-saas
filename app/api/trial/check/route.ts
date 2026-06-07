import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Daily cron: downgrade expired trials to FREE plan
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = new Date()

  // Find orgs whose trial has expired and have no active Stripe subscription
  const expired = await prisma.organization.findMany({
    where: {
      plan:        "PROFESSIONAL",
      trialEndsAt: { lt: now },
      stripeSubId: null,
    },
    select: { id: true, name: true },
  })

  if (expired.length === 0) {
    return NextResponse.json({ downgraded: 0 })
  }

  await prisma.organization.updateMany({
    where: { id: { in: expired.map((o) => o.id) } },
    data:  { plan: "FREE", trialEndsAt: null },
  })

  // Notify each downgraded org
  for (const org of expired) {
    prisma.notification.create({
      data: {
        organizationId: org.id,
        type:  "GENERAL",
        title: "انتهت فترتك التجريبية",
        body:  "انتهت تجربتك المجانية لمدة 14 يوماً. اشترك الآن للاستمرار في الوصول إلى جميع الميزات.",
        href:  "/dashboard/billing",
      },
    }).catch(() => {})
  }

  return NextResponse.json({ downgraded: expired.length, orgs: expired.map((o) => o.name) })
}

export async function GET(req: NextRequest) {
  return POST(req)
}

import { NextRequest, NextResponse } from "next/server"
import { stripe, planFromPriceId } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get("stripe-signature") ?? ""
  const secret    = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const sess = event.data.object as Stripe.Checkout.Session
        if (sess.mode !== "subscription") break
        const orgId  = sess.metadata?.orgId
        const planId = sess.metadata?.planId
        if (!orgId || !planId) break

        const sub = await stripe.subscriptions.retrieve(sess.subscription as string)
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan:            planId as any,
            stripeCustomerId: sess.customer as string,
            stripeSubId:     sub.id,
            planExpiresAt:   new Date(sub.current_period_end * 1000),
          },
        })
        break
      }

      case "customer.subscription.updated": {
        const sub    = event.data.object as Stripe.Subscription
        const orgId  = sub.metadata?.orgId
        if (!orgId) break
        const priceId = sub.items.data[0]?.price?.id
        const planId  = planFromPriceId(priceId)
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan:          planId as any,
            stripeSubId:   sub.id,
            planExpiresAt: new Date(sub.current_period_end * 1000),
          },
        })
        break
      }

      case "customer.subscription.deleted": {
        const sub   = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.orgId
        if (!orgId) break
        await prisma.organization.update({
          where: { id: orgId },
          data:  { plan: "FREE", stripeSubId: null, planExpiresAt: null },
        })
        break
      }

      case "invoice.payment_failed": {
        const inv    = event.data.object as Stripe.Invoice
        const subId  = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id
        if (!subId) break
        const sub   = await stripe.subscriptions.retrieve(subId)
        const orgId = sub.metadata?.orgId
        if (!orgId) break
        // Fire notification (fire-and-forget)
        prisma.notification.create({
          data: {
            organizationId: orgId,
            type:  "GENERAL",
            title: "فشل تجديد الاشتراك",
            body:  "تعذّر تجديد اشتراكك تلقائياً. يرجى تحديث بيانات الدفع.",
            href:  "/dashboard/billing",
          },
        }).catch(() => {})
        break
      }
    }
  } catch (err: any) {
    console.error("Stripe webhook handler error:", err.message)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

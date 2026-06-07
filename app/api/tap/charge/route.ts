import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCountry } from "@/lib/countries"
import { createTapCharge } from "@/lib/tap"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!process.env.TAP_SECRET_KEY) {
    return NextResponse.json({ error: "TAP_SECRET_KEY غير مُعدّ في متغيرات البيئة" }, { status: 503 })
  }

  const { invoiceId } = await req.json()
  if (!invoiceId) return NextResponse.json({ error: "invoiceId مطلوب" }, { status: 400 })

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: userOrg.organizationId },
    include: { contact: true },
  })
  if (!invoice) return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 })
  if (Number(invoice.amountDue) <= 0) {
    return NextResponse.json({ error: "هذه الفاتورة مدفوعة بالكامل" }, { status: 400 })
  }

  const org = userOrg.organization
  const country = getCountry(org.country)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  try {
    const charge = await createTapCharge({
      amount: Number(invoice.amountDue),
      currency: country.currency,
      customerName: invoice.contact.name,
      customerEmail: invoice.contact.email,
      customerPhone: invoice.contact.phone,
      description: `فاتورة ${invoice.number} — ${org.name}`,
      orderId: invoice.id,
      redirectUrl: `${appUrl}/dashboard/payments/tap?invoiceId=${invoice.id}&chargeId=CHARGE_ID`,
      webhookUrl: `${appUrl}/api/tap/webhook`,
    })

    // The redirect URL needs the actual charge ID — Tap substitutes {charge_id} but we pass it manually
    // Tap returns transaction.url which is the hosted page URL
    return NextResponse.json({ chargeId: charge.id, payUrl: charge.transaction.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "فشل إنشاء الدفعة" }, { status: 500 })
  }
}

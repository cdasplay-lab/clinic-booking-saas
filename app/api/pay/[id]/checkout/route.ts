import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { getCountry } from "@/lib/countries"

// Stripe-supported currencies in our target markets
const STRIPE_CURRENCIES = new Set(["SAR", "AED", "KWD", "QAR", "BHD", "OMR", "USD", "EUR", "GBP", "EGP"])

// Currencies where Stripe requires integer amounts (zero-decimal)
const ZERO_DECIMAL_CURRENCIES = new Set(["BIF", "CLP", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"])

function toStripeAmount(amount: number, currency: string) {
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())) return Math.round(amount)
  return Math.round(amount * 100)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      contact:      true,
      organization: { select: { id: true, name: true, country: true, stripeCustomerId: true } },
    },
  })
  if (!invoice) return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 })
  if (invoice.status === "PAID" || Number(invoice.amountDue) <= 0) {
    return NextResponse.json({ error: "هذه الفاتورة مدفوعة بالكامل" }, { status: 400 })
  }
  if (["CANCELLED", "DRAFT"].includes(invoice.status)) {
    return NextResponse.json({ error: "هذه الفاتورة غير قابلة للدفع" }, { status: 400 })
  }

  const org     = invoice.organization
  const country = getCountry(org.country)
  const currency = country.currency.toUpperCase()

  if (!STRIPE_CURRENCIES.has(currency)) {
    return NextResponse.json({ error: `عملة ${currency} غير مدعومة للدفع الإلكتروني` }, { status: 400 })
  }

  const appUrl  = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const amount  = Number(invoice.amountDue)
  const invoiceTitle = country.vatEnabled ? "فاتورة ضريبية" : "فاتورة"

  const session = await stripe.checkout.sessions.create({
    mode:                "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency:     currency.toLowerCase(),
        unit_amount:  toStripeAmount(amount, currency),
        product_data: {
          name:        `${invoiceTitle} ${invoice.number}`,
          description: `${org.name} — ${invoice.contact.name}`,
        },
      },
      quantity: 1,
    }],
    customer_email:  invoice.contact.email || undefined,
    success_url: `${appUrl}/pay/${invoice.id}?success=1`,
    cancel_url:  `${appUrl}/pay/${invoice.id}?cancelled=1`,
    metadata: {
      invoiceId: invoice.id,
      orgId:     org.id,
      contactId: invoice.contactId,
      type:      "INVOICE_PAYMENT",
    },
  })

  return NextResponse.json({ url: session.url })
}

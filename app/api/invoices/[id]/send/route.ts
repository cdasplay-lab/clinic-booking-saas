import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCountry } from "@/lib/countries"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { createTransport, buildInvoiceEmail } from "@/lib/email"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { contact: true },
  })
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const toEmail: string = body.email || invoice.contact.email || ""

  if (!toEmail || !toEmail.includes("@")) {
    return NextResponse.json({ error: "لم يتم تحديد بريد إلكتروني للعميل" }, { status: 400 })
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return NextResponse.json({ error: "SMTP غير مُعدّ — أضف SMTP_USER وSMTP_PASS في متغيرات البيئة" }, { status: 503 })
  }

  const org = userOrg.organization
  const country = getCountry(org.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const invoiceTitle = country.vatEnabled ? "فاتورة ضريبية" : "فاتورة"

  const { subject, html, text } = buildInvoiceEmail({
    invoiceNumber: invoice.number,
    invoiceTitle,
    orgName: org.name,
    orgEmail: org.email || process.env.SMTP_USER,
    contactName: invoice.contact.name,
    contactEmail: toEmail,
    total: fmt(Number(invoice.total)),
    dueDate: formatDateShort(invoice.dueDate),
    invoiceUrl: `${appUrl}/dashboard/invoices/${invoice.id}`,
    notes: invoice.notes,
  })

  try {
    const transporter = createTransport()
    await transporter.sendMail({
      from: `"${org.name}" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html,
      text,
    })
  } catch (err: any) {
    console.error("Email send error:", err)
    return NextResponse.json({ error: `فشل إرسال البريد: ${err.message}` }, { status: 500 })
  }

  // Mark invoice as SENT if it was DRAFT
  if (invoice.status === "DRAFT") {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "SENT" },
    })
  }

  await writeAuditLog({
    organizationId: userOrg.organizationId,
    userId: session.user.id,
    userName: session.user.name || session.user.email || "",
    action: "SEND",
    entityType: "INVOICE",
    entityId: invoice.id,
    entityLabel: invoice.number,
    changes: { email: [null, toEmail] },
    ipAddress: req.headers.get("x-forwarded-for") || undefined,
  })

  return NextResponse.json({ success: true, to: toEmail })
}

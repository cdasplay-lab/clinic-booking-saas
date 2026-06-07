import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePDF } from "@/lib/pdf/invoice-pdf"
import { getCountry } from "@/lib/countries"
import { createElement } from "react"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return new Response("Not found", { status: 404 })

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: {
      contact: true,
      items: {
        include: { taxRate: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  })
  if (!invoice) return new Response("Not found", { status: 404 })

  const org     = userOrg.organization
  const country = getCountry(org.country)

  const invoiceTitle = invoice.type === "CREDIT_NOTE"
    ? "إشعار خصم"
    : country.vatEnabled
      ? "فاتورة ضريبية"
      : "فاتورة"

  const pdfProps = {
    invoice: {
      number:         invoice.number,
      date:           invoice.date,
      dueDate:        invoice.dueDate,
      status:         invoice.status,
      subtotal:       Number(invoice.subtotal),
      discountAmount: Number(invoice.discountAmount),
      taxAmount:      Number(invoice.taxAmount),
      total:          Number(invoice.total),
      amountPaid:     Number(invoice.amountPaid),
      amountDue:      Number(invoice.amountDue),
      notes:          invoice.notes,
      terms:          invoice.terms,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity:    Number(item.quantity),
        unitPrice:   Number(item.unitPrice),
        taxAmount:   Number(item.taxAmount),
        total:       Number(item.total),
        taxRate:     item.taxRate
          ? { rate: Number(item.taxRate.rate), name: item.taxRate.name }
          : null,
      })),
      contact: {
        name:      invoice.contact.name,
        email:     invoice.contact.email,
        phone:     invoice.contact.phone,
        address:   invoice.contact.address,
        taxNumber: invoice.contact.taxNumber,
      },
    },
    org: {
      name:      org.name,
      address:   org.address,
      phone:     org.phone,
      email:     org.email,
      taxNumber: org.taxNumber,
      country:   org.country,
    },
    currencySymbol: country.currencySymbol,
    invoiceTitle,
    vatName: country.vatEnabled ? country.vatName : undefined,
  }

  const element = createElement(InvoicePDF, pdfProps)
  const buffer  = await renderToBuffer(element as any)

  const filename = encodeURIComponent(`${invoiceTitle}_${invoice.number}.pdf`)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
    },
  })
}

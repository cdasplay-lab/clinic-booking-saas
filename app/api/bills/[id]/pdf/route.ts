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

  const bill = await prisma.bill.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: {
      contact: true,
      items: {
        include: { taxRate: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  })
  if (!bill) return new Response("Not found", { status: 404 })

  const org     = userOrg.organization
  const country = getCountry(org.country)

  const pdfProps = {
    invoice: {
      number:         bill.number,
      date:           bill.date,
      dueDate:        bill.dueDate,
      status:         bill.status === "OPEN" ? "SENT" : bill.status,
      subtotal:       Number(bill.subtotal),
      discountAmount: Number(bill.discountAmount),
      taxAmount:      Number(bill.taxAmount),
      total:          Number(bill.total),
      amountPaid:     Number(bill.amountPaid),
      amountDue:      Number(bill.amountDue),
      notes:          bill.notes,
      terms:          null,
      items: bill.items.map((item) => ({
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
        name:      bill.contact.name,
        email:     bill.contact.email,
        phone:     bill.contact.phone,
        address:   bill.contact.address,
        taxNumber: bill.contact.taxNumber,
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
    invoiceTitle:   "فاتورة مورد",
    vatName:        country.vatEnabled ? country.vatName : undefined,
  }

  const element = createElement(InvoicePDF, pdfProps)
  const buffer  = await renderToBuffer(element as any)
  const filename = encodeURIComponent(`فاتورة_مورد_${bill.number}.pdf`)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
    },
  })
}

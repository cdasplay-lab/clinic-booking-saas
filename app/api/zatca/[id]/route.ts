import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCountry } from "@/lib/countries"
import { buildZatcaTlv } from "@/lib/zatca"
import QRCode from "qrcode"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return new Response("Not found", { status: 404 })

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!invoice) return new Response("Not found", { status: 404 })

  const org = userOrg.organization
  const country = getCountry(org.country)

  // Only generate for VAT-enabled countries (primarily SA)
  if (!country.vatEnabled) {
    return new Response("QR not applicable for this country", { status: 400 })
  }

  const tlvBase64 = buildZatcaTlv({
    sellerName: org.name,
    vatNumber: org.taxNumber || "",
    invoiceDate: invoice.date,
    invoiceTotal: Number(invoice.total),
    vatAmount: Number(invoice.taxAmount),
  })

  const format = req.nextUrl.searchParams.get("format") || "svg"

  if (format === "png") {
    const pngBuffer = await QRCode.toBuffer(tlvBase64, {
      type: "png",
      width: 200,
      margin: 1,
      errorCorrectionLevel: "M",
    })
    return new Response(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    })
  }

  // Default: SVG
  const svg = await QRCode.toString(tlvBase64, {
    type: "svg",
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  })

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  })
}

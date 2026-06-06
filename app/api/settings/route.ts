import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCountry } from "@/lib/countries"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(userOrg.organization)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const body = await req.json()
  const { name, email, phone, address, city, country, taxNumber, logo, fiscalYearStart } = body

  if (!name?.trim()) return NextResponse.json({ error: "اسم الشركة مطلوب" }, { status: 400 })

  const countryConfig = getCountry(country || "SA")

  const org = await prisma.organization.update({
    where: { id: userOrg.organizationId },
    data: {
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      country: countryConfig.code,
      baseCurrency: countryConfig.currency,
      taxNumber: taxNumber?.trim() || null,
      logo: logo?.trim() || null,
      fiscalYearStart: fiscalYearStart ? Number(fiscalYearStart) : 1,
    },
  })

  return NextResponse.json(org)
}

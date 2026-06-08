import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")

  const contacts = await prisma.contact.findMany({
    where: {
      organizationId: userOrg.organizationId,
      isActive: true,
      ...(type === "CUSTOMER" ? { type: { in: ["CUSTOMER", "BOTH"] } } : {}),
      ...(type === "VENDOR" ? { type: { in: ["VENDOR", "BOTH"] } } : {}),
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(contacts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const body = await req.json()
  const { name, email, phone, type, taxNumber, paymentTerms, address, priceLevel, creditLimit } = body

  if (!name || !type) {
    return NextResponse.json({ error: "الاسم والنوع مطلوبان" }, { status: 400 })
  }

  const validLevels = ["RETAIL", "WHOLESALE", "VIP"]

  const contact = await prisma.contact.create({
    data: {
      organizationId: userOrg.organizationId,
      name,
      email,
      phone,
      type,
      taxNumber,
      paymentTerms: parseInt(paymentTerms) || 30,
      address,
      priceLevel: validLevels.includes(priceLevel) ? priceLevel : "RETAIL",
      creditLimit: creditLimit !== undefined && creditLimit !== "" && creditLimit !== null
        ? parseFloat(creditLimit) : null,
    },
  })

  await writeAuditLog({
    organizationId: userOrg.organizationId,
    userId: session.user.id,
    userName: session.user.name || session.user.email || "",
    action: "CREATE",
    entityType: "CONTACT",
    entityId: contact.id,
    entityLabel: contact.name,
    ipAddress: req.headers.get("x-forwarded-for") || undefined,
  })

  return NextResponse.json(contact, { status: 201 })
}

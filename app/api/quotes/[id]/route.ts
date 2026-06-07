import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const quote = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId, type: "QUOTE" },
    include: {
      contact: true,
      items: { include: { taxRate: true }, orderBy: { sortOrder: "asc" } },
    },
  })
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(quote)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const quote = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId, type: "QUOTE" },
  })
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { status } = await req.json()
  const allowed = ["DRAFT", "SENT", "ACCEPTED", "CANCELLED"]
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 })
  }

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: { status },
  })

  return NextResponse.json(updated)
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(userOrg.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const recurring = await prisma.recurringInvoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!recurring) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const { status } = body

  const updated = await prisma.recurringInvoice.update({
    where: { id: params.id },
    data: { status },
    include: { contact: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const recurring = await prisma.recurringInvoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!recurring) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.recurringInvoice.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

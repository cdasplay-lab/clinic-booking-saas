import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const note = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId, type: "CREDIT_NOTE" },
    include: {
      contact:         true,
      items:           { include: { taxRate: true } },
      creditedInvoice: { select: { id: true, number: true } },
    },
  })
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(note)
}

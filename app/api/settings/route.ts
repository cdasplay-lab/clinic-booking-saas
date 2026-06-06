import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

  const body = await req.json()
  const { name, email, phone, address, taxNumber } = body

  const org = await prisma.organization.update({
    where: { id: userOrg.organizationId },
    data: { name, email, phone, address, taxNumber },
  })

  return NextResponse.json(org)
}

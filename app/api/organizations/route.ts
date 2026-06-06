import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgs = await prisma.userOrganization.findMany({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { isDefault: "desc" },
  })

  return NextResponse.json(orgs)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { organizationId } = body

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, organizationId },
  })
  if (!userOrg) return NextResponse.json({ error: "Access denied" }, { status: 403 })

  // Set as default
  await prisma.userOrganization.updateMany({
    where: { userId: session.user.id },
    data: { isDefault: false },
  })
  await prisma.userOrganization.update({
    where: { id: userOrg.id },
    data: { isDefault: true },
  })

  return NextResponse.json({ success: true })
}

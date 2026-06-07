import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await req.json()
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 })

  // Verify user belongs to the target org
  const membership = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
  })
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  // Switch default org atomically
  await prisma.$transaction([
    prisma.userOrganization.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    }),
    prisma.userOrganization.update({
      where: { id: membership.id },
      data: { isDefault: true },
    }),
  ])

  return NextResponse.json({ success: true })
}

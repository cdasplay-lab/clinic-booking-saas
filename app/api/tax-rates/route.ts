import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json([], { status: 200 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const taxRates = await prisma.taxRate.findMany({
    where: { organizationId: userOrg.organizationId, isActive: true },
  })

  return NextResponse.json(taxRates)
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAccountNature } from "@/lib/utils"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")

  const accounts = await prisma.account.findMany({
    where: {
      organizationId: userOrg.organizationId,
      isActive: true,
      ...(type ? { accountType: type as any } : {}),
    },
    include: { group: true },
    orderBy: { code: "asc" },
  })

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const body = await req.json()
  const { code, name, groupId, accountType, description, openingBalance } = body

  if (!code || !name || !groupId || !accountType) {
    return NextResponse.json({ error: "البيانات الأساسية مطلوبة" }, { status: 400 })
  }

  const existing = await prisma.account.findUnique({
    where: { organizationId_code: { organizationId: userOrg.organizationId, code } },
  })
  if (existing) return NextResponse.json({ error: "كود الحساب مستخدم بالفعل" }, { status: 400 })

  const account = await prisma.account.create({
    data: {
      organizationId: userOrg.organizationId,
      code,
      name,
      groupId,
      accountType,
      nature: getAccountNature(accountType) as any,
      description,
      openingBalance: parseFloat(openingBalance || "0"),
      createdById: session.user.id,
    },
  })

  return NextResponse.json(account, { status: 201 })
}

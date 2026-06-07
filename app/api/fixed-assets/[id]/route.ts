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

  const asset = await prisma.fixedAsset.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { depreciations: { orderBy: { date: "desc" } } },
  })
  if (!asset) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  return NextResponse.json(asset)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const asset = await prisma.fixedAsset.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!asset) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const data = await req.json()
  const updated = await prisma.fixedAsset.update({
    where: { id: params.id },
    data: {
      name: data.name ?? asset.name,
      category: data.category ?? asset.category,
      status: data.status ?? asset.status,
      disposalDate: data.disposalDate ? new Date(data.disposalDate) : asset.disposalDate,
      disposalAmount: data.disposalAmount !== undefined ? data.disposalAmount : asset.disposalAmount,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const asset = await prisma.fixedAsset.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!asset) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  await prisma.fixedAsset.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

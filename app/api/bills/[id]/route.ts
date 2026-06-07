import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "No org" }, { status: 400 })

  const bill = await prisma.bill.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { contact: true, items: { include: { taxRate: true } }, apAccount: true },
  })

  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(bill)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "No org" }, { status: 400 })

  const body = await req.json()
  const bill = await prisma.bill.update({ where: { id: params.id }, data: body })
  return NextResponse.json(bill)
}

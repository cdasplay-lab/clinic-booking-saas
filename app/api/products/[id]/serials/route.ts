import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const AddSerialsSchema = z.object({
  serials: z.array(z.object({
    serialNumber:   z.string().min(1).max(100).trim(),
    condition:      z.enum(["NEW", "USED"]).default("NEW"),
    warrantyMonths: z.coerce.number().int().min(0).max(120).optional().nullable(),
    notes:          z.string().max(500).optional().nullable(),
  })).min(1).max(200),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  const serials = await prisma.productSerial.findMany({
    where: {
      organizationId: userOrg.organizationId,
      productId: params.id,
      ...(status ? { status: status as any } : {}),
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(serials)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const orgId = userOrg.organizationId

  // Verify the product belongs to the org
  const product = await prisma.product.findFirst({ where: { id: params.id, organizationId: orgId } })
  if (!product) return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 })

  const parsed = AddSerialsSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 })
  }

  // Ensure the product is flagged as serial-tracked
  if (!product.tracksSerial) {
    await prisma.product.update({ where: { id: product.id }, data: { tracksSerial: true } })
  }

  // Insert serials, skipping duplicates within the org
  let added = 0
  const skipped: string[] = []
  for (const s of parsed.data.serials) {
    const exists = await prisma.productSerial.findFirst({
      where: { organizationId: orgId, serialNumber: s.serialNumber },
    })
    if (exists) { skipped.push(s.serialNumber); continue }
    const warrantyEnd = s.warrantyMonths
      ? new Date(Date.now() + s.warrantyMonths * 30 * 86_400_000)
      : null
    await prisma.productSerial.create({
      data: {
        organizationId: orgId,
        productId: product.id,
        serialNumber: s.serialNumber,
        condition: s.condition,
        warrantyMonths: s.warrantyMonths || null,
        warrantyEnd,
        notes: s.notes || null,
        status: "IN_STOCK",
      },
    })
    added++
  }

  return NextResponse.json({ success: true, added, skipped })
}

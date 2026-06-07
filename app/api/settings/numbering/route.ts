import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_TYPES = ["INVOICE", "BILL", "QUOTE", "CN", "DN", "PO", "SO", "JOURNAL", "PAYMENT"]

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const sequences = await prisma.documentSequence.findMany({
    where: { organizationId: userOrg.organizationId },
    orderBy: { docType: "asc" },
  })

  // Include defaults for types not yet created
  const defaults: Record<string, { prefix: string; padding: number }> = {
    INVOICE: { prefix: "INV",  padding: 4 },
    BILL:    { prefix: "BILL", padding: 4 },
    QUOTE:   { prefix: "QT",   padding: 4 },
    CN:      { prefix: "CN",   padding: 4 },
    DN:      { prefix: "DN",   padding: 4 },
    PO:      { prefix: "PO",   padding: 4 },
    SO:      { prefix: "SO",   padding: 4 },
    JOURNAL: { prefix: "JNL",  padding: 4 },
    PAYMENT: { prefix: "PAY",  padding: 4 },
  }

  const result = ALLOWED_TYPES.map((t) => {
    const existing = sequences.find((s) => s.docType === t)
    return {
      docType: t,
      prefix: existing?.prefix ?? defaults[t]?.prefix ?? t.slice(0, 3),
      padding: existing?.padding ?? defaults[t]?.padding ?? 4,
      currentNumber: existing?.currentNumber ?? 0,
    }
  })

  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const { docType, prefix, padding } = await req.json()

  if (!ALLOWED_TYPES.includes(docType)) {
    return NextResponse.json({ error: "نوع المستند غير صالح" }, { status: 400 })
  }
  if (!prefix || prefix.length < 1 || prefix.length > 10) {
    return NextResponse.json({ error: "البادئة يجب أن تكون من 1-10 أحرف" }, { status: 400 })
  }
  if (padding < 1 || padding > 8) {
    return NextResponse.json({ error: "الحشو يجب أن يكون بين 1 و 8" }, { status: 400 })
  }

  const seq = await prisma.documentSequence.upsert({
    where: {
      organizationId_docType: {
        organizationId: userOrg.organizationId,
        docType,
      },
    },
    create: {
      organizationId: userOrg.organizationId,
      docType,
      prefix: prefix.toUpperCase().trim(),
      padding,
      currentNumber: 0,
    },
    update: {
      prefix: prefix.toUpperCase().trim(),
      padding,
    },
  })

  return NextResponse.json(seq)
}

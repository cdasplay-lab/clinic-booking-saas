import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]

// GET — list attachments for an entity
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const entityId   = req.nextUrl.searchParams.get("entityId")
  const entityType = req.nextUrl.searchParams.get("entityType")
  if (!entityId || !entityType) return NextResponse.json({ error: "entityId and entityType required" }, { status: 400 })

  const attachments = await prisma.attachment.findMany({
    where: { organizationId: userOrg.organizationId, entityId, entityType },
    select: {
      id: true, name: true, mimeType: true, size: true, createdAt: true,
      uploader: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(attachments)
}

// POST — upload a file
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const formData   = await req.formData()
  const file       = formData.get("file") as File | null
  const entityId   = formData.get("entityId") as string
  const entityType = formData.get("entityType") as string

  if (!file || !entityId || !entityType) {
    return NextResponse.json({ error: "file، entityId، entityType مطلوبة" }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "حجم الملف يتجاوز 10 ميغابايت" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "نوع الملف غير مسموح به" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const attachment = await prisma.attachment.create({
    data: {
      organizationId: userOrg.organizationId,
      uploadedBy: session.user.id,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      data: buffer,
      entityType,
      entityId,
    },
    select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
  })

  return NextResponse.json(attachment)
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — download / view file
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return new Response("Not found", { status: 404 })

  const attachment = await prisma.attachment.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!attachment) return new Response("Not found", { status: 404 })

  const inline = req.nextUrl.searchParams.get("inline") === "1"
  const disposition = inline
    ? `inline; filename="${encodeURIComponent(attachment.name)}"`
    : `attachment; filename="${encodeURIComponent(attachment.name)}"`

  return new Response(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": disposition,
      "Content-Length": String(attachment.size),
      "Cache-Control": "private, max-age=3600",
    },
  })
}

// DELETE — remove file
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const attachment = await prisma.attachment.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only uploader or OWNER/ADMIN can delete
  const isAdmin = ["OWNER", "ADMIN"].includes(userOrg.role)
  const isUploader = attachment.uploadedBy === session.user.id
  if (!isAdmin && !isUploader) {
    return NextResponse.json({ error: "ليس لديك صلاحية الحذف" }, { status: 403 })
  }

  await prisma.attachment.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

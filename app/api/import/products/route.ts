import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(userOrg.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: "buffer" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" })

  if (rows.length === 0) return NextResponse.json({ error: "الملف فارغ" }, { status: 400 })
  if (rows.length > 2000) return NextResponse.json({ error: "الحد الأقصى 2000 صف" }, { status: 400 })

  const preview = formData.get("preview") === "1"

  // Get max existing code to auto-generate
  const existingCodes = new Set(
    (await prisma.product.findMany({
      where: { organizationId: userOrg.organizationId },
      select: { code: true },
    })).map((p) => p.code)
  )

  let autoCodeIdx = existingCodes.size + 1

  const results: { row: number; name: string; status: "ok" | "error"; error?: string }[] = []
  const toCreate: {
    organizationId: string
    code: string
    name: string
    description?: string | null
    unit: string
    salePrice: number
    purchasePrice: number
    category?: string | null
    isInventoried: boolean
  }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = (row["name"] || row["الاسم"] || row["Name"] || "").trim()
    if (!name) {
      results.push({ row: i + 2, name: "-", status: "error", error: "الاسم مطلوب" })
      continue
    }

    let code = (row["code"] || row["الكود"] || row["Code"] || "").trim()
    if (!code) {
      code = `P${String(autoCodeIdx).padStart(4, "0")}`
      autoCodeIdx++
    }
    if (existingCodes.has(code)) {
      results.push({ row: i + 2, name, status: "error", error: `الكود ${code} موجود مسبقاً` })
      continue
    }
    existingCodes.add(code)

    results.push({ row: i + 2, name, status: "ok" })
    toCreate.push({
      organizationId: userOrg.organizationId,
      code,
      name,
      description: (row["description"] || row["الوصف"] || "").trim() || null,
      unit: (row["unit"] || row["الوحدة"] || "PCS").trim() || "PCS",
      salePrice: parseFloat(row["salePrice"] || row["سعر البيع"] || "0") || 0,
      purchasePrice: parseFloat(row["purchasePrice"] || row["سعر الشراء"] || "0") || 0,
      category: (row["category"] || row["الفئة"] || "").trim() || null,
      isInventoried: true,
    })
  }

  if (preview) return NextResponse.json({ results, total: rows.length })

  const errors = results.filter((r) => r.status === "error")

  if (toCreate.length === 0) {
    return NextResponse.json({ error: "لا توجد صفوف صالحة للاستيراد", results }, { status: 400 })
  }

  await prisma.product.createMany({ data: toCreate, skipDuplicates: true })

  await writeAuditLog({
    organizationId: userOrg.organizationId,
    userId: session.user.id,
    userName: session.user.name || session.user.email || "",
    action: "IMPORT",
    entityType: "PRODUCT",
    entityId: userOrg.organizationId,
    entityLabel: `استيراد ${toCreate.length} منتج`,
    ipAddress: req.headers.get("x-forwarded-for") || undefined,
  })

  return NextResponse.json({
    imported: toCreate.length,
    skipped: errors.length,
    results,
  })
}

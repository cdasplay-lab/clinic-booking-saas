import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { writeAuditLog } from "@/lib/audit"

const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]

function normalizeType(v: string | undefined): "CUSTOMER" | "VENDOR" | "BOTH" {
  const s = (v || "").trim().toUpperCase()
  if (s === "CUSTOMER" || s === "عميل") return "CUSTOMER"
  if (s === "VENDOR"   || s === "مورد") return "VENDOR"
  return "BOTH"
}

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

  if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم — استخدم Excel أو CSV" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: "buffer" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" })

  if (rows.length === 0) return NextResponse.json({ error: "الملف فارغ" }, { status: 400 })
  if (rows.length > 1000) return NextResponse.json({ error: "الحد الأقصى 1000 صف" }, { status: 400 })

  const preview = formData.get("preview") === "1"

  const results: { row: number; name: string; status: "ok" | "error"; error?: string }[] = []
  const toCreate: {
    organizationId: string
    name: string
    type: "CUSTOMER" | "VENDOR" | "BOTH"
    email?: string | null
    phone?: string | null
    address?: string | null
    taxNumber?: string | null
    paymentTerms: number
  }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = (row["name"] || row["الاسم"] || row["Name"] || "").trim()
    if (!name) {
      results.push({ row: i + 2, name: "-", status: "error", error: "الاسم مطلوب" })
      continue
    }
    const type = normalizeType(row["type"] || row["النوع"] || row["Type"])
    results.push({ row: i + 2, name, status: "ok" })
    toCreate.push({
      organizationId: userOrg.organizationId,
      name,
      type,
      email: (row["email"] || row["البريد"] || row["Email"] || "").trim() || null,
      phone: (row["phone"] || row["الهاتف"] || row["Phone"] || "").trim() || null,
      address: (row["address"] || row["العنوان"] || row["Address"] || "").trim() || null,
      taxNumber: (row["taxNumber"] || row["الرقم الضريبي"] || row["TaxNumber"] || "").trim() || null,
      paymentTerms: parseInt(row["paymentTerms"] || row["شروط الدفع"] || "30") || 30,
    })
  }

  if (preview) return NextResponse.json({ results, total: rows.length })

  const errors = results.filter((r) => r.status === "error")
  const valid = toCreate

  if (valid.length === 0) {
    return NextResponse.json({ error: "لا توجد صفوف صالحة للاستيراد", results }, { status: 400 })
  }

  await prisma.contact.createMany({ data: valid, skipDuplicates: true })

  await writeAuditLog({
    organizationId: userOrg.organizationId,
    userId: session.user.id,
    userName: session.user.name || session.user.email || "",
    action: "IMPORT",
    entityType: "CONTACT",
    entityId: userOrg.organizationId,
    entityLabel: `استيراد ${valid.length} جهة اتصال`,
    ipAddress: req.headers.get("x-forwarded-for") || undefined,
  })

  return NextResponse.json({
    imported: valid.length,
    skipped: errors.length,
    results,
  })
}

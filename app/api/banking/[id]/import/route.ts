import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseBankCSV } from "@/lib/bank-import"

// POST /api/banking/[id]/import
// Accepts a CSV file, parses it, returns parsed rows for preview (no DB writes)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!bankAccount) return NextResponse.json({ error: "الحساب البنكي غير موجود" }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "لم يتم إرسال أي ملف" }, { status: 400 })

  const ext = file.name.split(".").pop()?.toLowerCase()
  if (!["csv", "xlsx", "xls"].includes(ext || "")) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم. استخدم CSV أو XLSX" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const result = parseBankCSV(buffer)

  // Fetch existing transactions to flag duplicates
  const existing = await prisma.bankTransaction.findMany({
    where: { bankAccountId: params.id },
    select: { date: true, debit: true, credit: true, description: true },
  })

  const existingKeys = new Set(
    existing.map((t) =>
      `${t.date.toISOString().split("T")[0]}_${Number(t.debit)}_${Number(t.credit)}_${t.description.slice(0, 30)}`
    )
  )

  const rowsWithDuplicateFlag = result.rows.map((row) => {
    const key = `${row.date}_${row.debit}_${row.credit}_${row.description.slice(0, 30)}`
    return { ...row, isDuplicate: existingKeys.has(key) }
  })

  return NextResponse.json({
    rows:    rowsWithDuplicateFlag,
    headers: result.headers,
    mapping: result.mapping,
    errors:  result.errors,
    total:   rowsWithDuplicateFlag.length,
    duplicates: rowsWithDuplicateFlag.filter((r) => r.isDuplicate).length,
  })
}

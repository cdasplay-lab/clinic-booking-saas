import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import * as XLSX from "xlsx"

const templates: Record<string, { headers: string[]; sample: string[][] }> = {
  contacts: {
    headers: ["name", "type", "email", "phone", "address", "taxNumber", "paymentTerms"],
    sample: [
      ["شركة الأمل للتجارة", "CUSTOMER", "info@amal.com", "0501234567", "الرياض، حي العليا", "300123456700003", "30"],
      ["مورد الإلكترونيات", "VENDOR", "vendor@elec.com", "0551234567", "جدة، حي الصفا", "", "15"],
      ["شركة الخليج", "BOTH", "gulf@co.com", "0561234567", "دبي", "1234567890", "45"],
    ],
  },
  products: {
    headers: ["code", "name", "description", "unit", "salePrice", "purchasePrice", "category"],
    sample: [
      ["P001", "جهاز حاسوب محمول", "لابتوب ديل i7 16GB", "PCS", "3500", "2800", "إلكترونيات"],
      ["P002", "طابعة ليزر", "طابعة HP LaserJet", "PCS", "850", "650", "مكتبية"],
      ["P003", "ورق A4", "رزمة ورق 500 ورقة", "BOX", "25", "18", "مستلزمات مكتبية"],
    ],
  },
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const type = req.nextUrl.searchParams.get("type") || "contacts"
  const tpl = templates[type]
  if (!tpl) return new Response("Unknown template type", { status: 400 })

  const wb = XLSX.utils.book_new()
  const data = [tpl.headers, ...tpl.sample]
  const ws = XLSX.utils.aoa_to_sheet(data)

  // Style header row width
  ws["!cols"] = tpl.headers.map(() => ({ wch: 22 }))

  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  const filename = encodeURIComponent(`template_${type}.xlsx`)
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

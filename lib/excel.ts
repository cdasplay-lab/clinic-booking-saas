import * as XLSX from "xlsx"
import { getCountry } from "./countries"
import { formatCurrency } from "./utils"

type Row = (string | number | null)[]

function buildWorkbook(sheets: { name: string; rows: Row[]; headerRow?: number }[]) {
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows)

    // Style header row bold (column widths)
    const cols = sheet.rows[0]?.length ?? 5
    ws["!cols"] = Array(cols).fill({ wch: 22 })

    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
}

function header(org: string, title: string, date: string): Row[] {
  return [
    [org],
    [title],
    [date],
    [],
  ]
}

// ── Trial Balance ─────────────────────────────────────────────────────────────
export function trialBalanceXlsx(
  accounts: { accountCode: string; accountName: string; groupName: string; nature: string; balance: number }[],
  org: string,
  countryCode: string,
  asOf: Date,
) {
  const country = getCountry(countryCode)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  const totalDebit  = accounts.reduce((s, a) => s + (a.nature === "DEBIT"  && a.balance > 0 ? a.balance : 0), 0)
  const totalCredit = accounts.reduce((s, a) => s + (a.nature === "CREDIT" && a.balance > 0 ? a.balance : 0), 0)

  const rows: Row[] = [
    ...header(org, "ميزان المراجعة", `حتى: ${asOf.toLocaleDateString("ar-SA")}`),
    ["كود الحساب", "اسم الحساب", "المجموعة", "مدين", "دائن"],
    ...accounts.map((a) => [
      a.accountCode,
      a.accountName,
      a.groupName,
      a.nature === "DEBIT"  && a.balance > 0 ? a.balance : "",
      a.nature === "CREDIT" && a.balance > 0 ? a.balance : "",
    ]),
    [],
    ["", "", "المجموع", totalDebit, totalCredit],
  ]

  return buildWorkbook([{ name: "ميزان المراجعة", rows }])
}

// ── Profit & Loss ─────────────────────────────────────────────────────────────
export function profitLossXlsx(
  data: { revenues: any[]; expenses: any[]; totalRevenue: number; totalExpenses: number; netProfit: number },
  org: string,
  countryCode: string,
  from: Date,
  to: Date,
) {
  const country = getCountry(countryCode)

  const rows: Row[] = [
    ...header(org, "قائمة الأرباح والخسائر", `من ${from.toLocaleDateString("ar-SA")} إلى ${to.toLocaleDateString("ar-SA")}`),
    ["البند", `المبلغ (${country.currencySymbol})`],
    ["── الإيرادات ──", ""],
    ...data.revenues.map((r) => [r.name, r.amount]),
    ["إجمالي الإيرادات", data.totalRevenue],
    [],
    ["── المصروفات ──", ""],
    ...data.expenses.map((e) => [e.name, e.amount]),
    ["إجمالي المصروفات", data.totalExpenses],
    [],
    [data.netProfit >= 0 ? "صافي الربح" : "صافي الخسارة", Math.abs(data.netProfit)],
  ]

  return buildWorkbook([{ name: "أرباح وخسائر", rows }])
}

// ── Invoices List ─────────────────────────────────────────────────────────────
export function invoicesXlsx(
  invoices: any[],
  org: string,
  countryCode: string,
) {
  const country = getCountry(countryCode)
  const statusMap: Record<string, string> = {
    DRAFT: "مسودة", SENT: "مرسلة", PARTIAL: "جزئي",
    PAID: "مدفوعة", OVERDUE: "متأخرة", CANCELLED: "ملغاة",
  }

  const rows: Row[] = [
    ...header(org, "قائمة الفواتير", new Date().toLocaleDateString("ar-SA")),
    ["رقم الفاتورة", "العميل", "تاريخ الفاتورة", "تاريخ الاستحقاق", "الإجمالي", "المدفوع", "المتبقي", `العملة`, "الحالة"],
    ...invoices.map((inv) => [
      inv.number,
      inv.contact?.name || "",
      new Date(inv.date).toLocaleDateString("ar-SA"),
      new Date(inv.dueDate).toLocaleDateString("ar-SA"),
      Number(inv.total),
      Number(inv.amountPaid),
      Number(inv.amountDue),
      country.currencySymbol,
      statusMap[inv.status] || inv.status,
    ]),
    [],
    ["المجموع", "", "", "",
      invoices.reduce((s, i) => s + Number(i.total), 0),
      invoices.reduce((s, i) => s + Number(i.amountPaid), 0),
      invoices.reduce((s, i) => s + Number(i.amountDue), 0),
    ],
  ]

  return buildWorkbook([{ name: "الفواتير", rows }])
}

// ── Bills List ────────────────────────────────────────────────────────────────
export function billsXlsx(bills: any[], org: string, countryCode: string) {
  const country = getCountry(countryCode)
  const statusMap: Record<string, string> = {
    DRAFT: "مسودة", OPEN: "مفتوحة", PARTIAL: "جزئي",
    PAID: "مدفوعة", OVERDUE: "متأخرة", CANCELLED: "ملغاة",
  }

  const rows: Row[] = [
    ...header(org, "قائمة فواتير الموردين", new Date().toLocaleDateString("ar-SA")),
    ["رقم الفاتورة", "المورد", "تاريخ الفاتورة", "تاريخ الاستحقاق", "الإجمالي", "المدفوع", "المتبقي", "العملة", "الحالة"],
    ...bills.map((b) => [
      b.number,
      b.contact?.name || "",
      new Date(b.billDate).toLocaleDateString("ar-SA"),
      new Date(b.dueDate).toLocaleDateString("ar-SA"),
      Number(b.total),
      Number(b.amountPaid),
      Number(b.amountDue),
      country.currencySymbol,
      statusMap[b.status] || b.status,
    ]),
    [],
    ["المجموع", "", "", "",
      bills.reduce((s, b) => s + Number(b.total), 0),
      bills.reduce((s, b) => s + Number(b.amountPaid), 0),
      bills.reduce((s, b) => s + Number(b.amountDue), 0),
    ],
  ]

  return buildWorkbook([{ name: "فواتير الموردين", rows }])
}

// ── Journal Entries ───────────────────────────────────────────────────────────
export function journalsXlsx(journals: any[], org: string, countryCode: string) {
  const country = getCountry(countryCode)
  const rows: Row[] = [
    ...header(org, "دفتر اليومية", new Date().toLocaleDateString("ar-SA")),
    ["رقم القيد", "التاريخ", "البيان", "مدين", "دائن", "الحالة"],
    ...journals.map((j) => [
      j.number,
      new Date(j.date).toLocaleDateString("ar-SA"),
      j.description,
      Number(j.totalDebit),
      Number(j.totalCredit),
      j.status === "POSTED" ? "مرحّل" : "مسودة",
    ]),
    [],
    ["المجموع", "", "",
      journals.reduce((s, j) => s + Number(j.totalDebit), 0),
      journals.reduce((s, j) => s + Number(j.totalCredit), 0),
    ],
  ]

  return buildWorkbook([{ name: "اليومية", rows }])
}

export function xlsxResponse(buffer: Buffer, filename: string) {
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
    },
  })
}

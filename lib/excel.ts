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

// ── Contacts ──────────────────────────────────────────────────────────────────
export function contactsXlsx(contacts: any[], org: string) {
  const typeMap: Record<string, string> = { CUSTOMER: "عميل", VENDOR: "مورد", BOTH: "عميل ومورد" }
  const rows: Row[] = [
    ...header(org, "جهات الاتصال", new Date().toLocaleDateString("ar-SA")),
    ["الاسم", "النوع", "الهاتف", "البريد الإلكتروني", "الرقم الضريبي", "العنوان", "الحالة"],
    ...contacts.map((c) => [
      c.name, typeMap[c.type] || c.type, c.phone || "", c.email || "",
      c.taxNumber || "", c.address || "", c.isActive ? "نشط" : "غير نشط",
    ]),
  ]
  return buildWorkbook([{ name: "جهات الاتصال", rows }])
}

// ── Payments ──────────────────────────────────────────────────────────────────
export function paymentsXlsx(payments: any[], org: string, countryCode: string) {
  const country = getCountry(countryCode)
  const methodMap: Record<string, string> = {
    CASH: "نقدي", BANK_TRANSFER: "تحويل بنكي", CHEQUE: "شيك",
    CARD: "بطاقة", ONLINE: "دفع إلكتروني",
  }
  const rows: Row[] = [
    ...header(org, "المدفوعات", new Date().toLocaleDateString("ar-SA")),
    ["رقم الفاتورة/الوثيقة", "جهة الاتصال", "التاريخ", "النوع", "طريقة الدفع", "المبلغ", "المرجع"],
    ...payments.map((p) => [
      p.invoice?.number || p.bill?.number || "",
      p.contact?.name || "",
      new Date(p.date).toLocaleDateString("ar-SA"),
      p.type === "INCOMING" ? "وارد" : "صادر",
      methodMap[p.method] || p.method,
      Number(p.amount),
      p.reference || "",
    ]),
    [],
    ["المجموع", "", "", "", "", payments.reduce((s, p) => s + Number(p.amount), 0)],
  ]
  return buildWorkbook([{ name: "المدفوعات", rows }])
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────
export function accountsXlsx(accounts: any[], org: string) {
  const rows: Row[] = [
    ...header(org, "دليل الحسابات", new Date().toLocaleDateString("ar-SA")),
    ["كود الحساب", "اسم الحساب", "النوع", "المجموعة", "الطبيعة", "الرصيد"],
    ...accounts.map((a) => [
      a.code, a.name, a.accountType || "", a.group?.name || "",
      a.normalBalance || "", Number(a.currentBalance || 0),
    ]),
  ]
  return buildWorkbook([{ name: "دليل الحسابات", rows }])
}

// ── Products ──────────────────────────────────────────────────────────────────
export function productsXlsx(products: any[], org: string) {
  const rows: Row[] = [
    ...header(org, "المنتجات والخدمات", new Date().toLocaleDateString("ar-SA")),
    ["الرمز", "الاسم", "الوصف", "سعر البيع", "وحدة القياس", "النوع", "الحالة"],
    ...products.map((p) => [
      p.code || "", p.name, p.description || "",
      Number(p.salePrice || 0), p.unit || "", p.type || "", p.isActive ? "نشط" : "غير نشط",
    ]),
  ]
  return buildWorkbook([{ name: "المنتجات", rows }])
}

// ── Full Org Backup (multi-sheet) ─────────────────────────────────────────────
export function fullBackupXlsx(data: {
  org:      any
  invoices: any[]
  bills:    any[]
  payments: any[]
  contacts: any[]
  products: any[]
  accounts: any[]
  journals: any[]
}) {
  const { org } = data
  const country  = getCountry(org.country || "SA")
  const fmt      = (n: number) => n
  const now      = new Date().toLocaleDateString("ar-SA")
  const typeMap  = { CUSTOMER: "عميل", VENDOR: "مورد", BOTH: "عميل ومورد" } as any
  const statusInv = { DRAFT:"مسودة", SENT:"مرسلة", PARTIAL:"جزئي", PAID:"مدفوعة", OVERDUE:"متأخرة", CANCELLED:"ملغاة" } as any
  const statusBill = { DRAFT:"مسودة", OPEN:"مفتوحة", PARTIAL:"جزئي", PAID:"مدفوعة", OVERDUE:"متأخرة", CANCELLED:"ملغاة" } as any

  const sheets = [
    // ── Summary ──
    {
      name: "ملخص",
      rows: [
        [org.name],
        ["نسخة احتياطية شاملة"],
        [`تاريخ التصدير: ${now}`],
        [],
        ["البيان", "العدد"],
        ["الفواتير",            data.invoices.length],
        ["فواتير الموردين",     data.bills.length],
        ["المدفوعات",           data.payments.length],
        ["جهات الاتصال",        data.contacts.length],
        ["المنتجات",            data.products.length],
        ["الحسابات",            data.accounts.length],
        ["القيود اليومية",      data.journals.length],
      ] as Row[],
    },
    // ── Invoices ──
    {
      name: "الفواتير",
      rows: [
        ["رقم الفاتورة", "العميل", "التاريخ", "الاستحقاق", "الإجمالي", "المدفوع", "المتبقي", "الحالة"],
        ...data.invoices.map((i) => [
          i.number, i.contact?.name || "", new Date(i.date).toLocaleDateString("ar-SA"),
          new Date(i.dueDate).toLocaleDateString("ar-SA"),
          fmt(Number(i.total)), fmt(Number(i.amountPaid)), fmt(Number(i.amountDue)),
          statusInv[i.status] || i.status,
        ]),
      ] as Row[],
    },
    // ── Bills ──
    {
      name: "فواتير الموردين",
      rows: [
        ["رقم الفاتورة", "المورد", "التاريخ", "الاستحقاق", "الإجمالي", "المدفوع", "المتبقي", "الحالة"],
        ...data.bills.map((b) => [
          b.number, b.contact?.name || "",
          new Date(b.billDate || b.date).toLocaleDateString("ar-SA"),
          new Date(b.dueDate).toLocaleDateString("ar-SA"),
          fmt(Number(b.total)), fmt(Number(b.amountPaid)), fmt(Number(b.amountDue)),
          statusBill[b.status] || b.status,
        ]),
      ] as Row[],
    },
    // ── Payments ──
    {
      name: "المدفوعات",
      rows: [
        ["جهة الاتصال", "التاريخ", "النوع", "طريقة الدفع", "المبلغ", "المرجع"],
        ...data.payments.map((p) => [
          p.contact?.name || "", new Date(p.date).toLocaleDateString("ar-SA"),
          p.type === "INCOMING" ? "وارد" : "صادر", p.method || "",
          fmt(Number(p.amount)), p.reference || "",
        ]),
      ] as Row[],
    },
    // ── Contacts ──
    {
      name: "جهات الاتصال",
      rows: [
        ["الاسم", "النوع", "الهاتف", "البريد", "الرقم الضريبي", "العنوان"],
        ...data.contacts.map((c) => [
          c.name, typeMap[c.type] || c.type, c.phone || "", c.email || "",
          c.taxNumber || "", c.address || "",
        ]),
      ] as Row[],
    },
    // ── Products ──
    {
      name: "المنتجات",
      rows: [
        ["الرمز", "الاسم", "سعر البيع", "الوحدة", "النوع"],
        ...data.products.map((p) => [
          p.code || "", p.name, fmt(Number(p.salePrice || 0)), p.unit || "", p.type || "",
        ]),
      ] as Row[],
    },
    // ── Chart of Accounts ──
    {
      name: "دليل الحسابات",
      rows: [
        ["الكود", "الاسم", "النوع", "الرصيد الحالي"],
        ...data.accounts.map((a) => [
          a.code, a.name, a.accountType || "", fmt(Number(a.currentBalance || 0)),
        ]),
      ] as Row[],
    },
    // ── Journals ──
    {
      name: "القيود اليومية",
      rows: [
        ["رقم القيد", "التاريخ", "البيان", "مجموع المدين", "مجموع الدائن", "الحالة"],
        ...data.journals.map((j) => [
          j.number, new Date(j.date).toLocaleDateString("ar-SA"), j.description,
          fmt(Number(j.totalDebit)), fmt(Number(j.totalCredit)),
          j.status === "POSTED" ? "مرحّل" : "مسودة",
        ]),
      ] as Row[],
    },
  ]

  return buildWorkbook(sheets)
}

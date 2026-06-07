import * as XLSX from "xlsx"
import { round2 } from "@/lib/accounting"

export interface ParsedRow {
  date: string        // ISO date string YYYY-MM-DD
  description: string
  debit:  number
  credit: number
  balance: number
  raw: Record<string, string>  // original CSV row
}

export interface ParseResult {
  rows:    ParsedRow[]
  headers: string[]
  mapping: ColumnMapping
  errors:  string[]
}

interface ColumnMapping {
  date:        number
  description: number
  debit:       number
  credit:      number
  balance:     number
  amount:      number   // single amount column (-= debit, += credit)
}

// ── Column detection ──────────────────────────────────────────────────────────

const KEYWORDS: Record<keyof ColumnMapping, string[]> = {
  date:        ["تاريخ", "date", "transaction date", "posting date", "value date", "dt", "التاريخ"],
  description: ["وصف", "description", "بيان", "تفاصيل", "details", "narration", "remarks", "particulars", "البيان", "المعاملة"],
  debit:       ["مدين", "debit", "سحب", "خصم", "withdrawal", "dr", "withdrawals", "مدينه", "debit amount"],
  credit:      ["دائن", "credit", "إيداع", "ائتمان", "deposit", "cr", "deposits", "دائنه", "credit amount"],
  balance:     ["رصيد", "balance", "الرصيد", "running balance", "رصيد الحساب", "bal"],
  amount:      ["مبلغ", "amount", "المبلغ", "net amount", "value"],
}

function detectCol(headers: string[], type: keyof ColumnMapping): number {
  for (const kw of KEYWORDS[type]) {
    const idx = headers.findIndex((h) => h.toLowerCase().includes(kw.toLowerCase()))
    if (idx !== -1) return idx
  }
  return -1
}

// ── Number parsing ────────────────────────────────────────────────────────────

function parseNum(val: string | number | undefined): number {
  if (val === undefined || val === null || val === "") return 0
  const s = String(val).replace(/,/g, "").replace(/\s/g, "").trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : round2(n)
}

// ── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(val: string | number | undefined): string | null {
  if (!val) return null

  // Excel serial number
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) {
      const mm = String(d.m).padStart(2, "0")
      const dd = String(d.d).padStart(2, "0")
      return `${d.y}-${mm}-${dd}`
    }
  }

  const s = String(val).trim()

  // Try common formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})/,              // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})/,            // DD/MM/YYYY or MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})/,              // DD-MM-YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,      // D/M/YY
  ]

  for (const pat of patterns) {
    const m = s.match(pat)
    if (!m) continue
    let year: number, month: number, day: number

    if (pat === patterns[0]) {
      ;[, year, month, day] = m.map(Number) as any
    } else {
      const [, a, b, c] = m.map(Number)
      year  = c < 100 ? c + 2000 : c
      // Heuristic: if a > 12 it's day, else ambiguous — assume DD/MM
      day   = a > 12 ? a : a
      month = a > 12 ? b : b
    }

    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
  }

  // Fall back to Date.parse
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]

  return null
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseBankCSV(buffer: Buffer): ParseResult {
  const errors: string[] = []

  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" })

  if (!raw || raw.length < 2) {
    return { rows: [], headers: [], mapping: { date: -1, description: -1, debit: -1, credit: -1, balance: -1, amount: -1 }, errors: ["الملف فارغ أو لا يحتوي على بيانات"] }
  }

  // Find header row (first row with at least 3 non-empty cells)
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const filled = raw[i].filter((c: any) => String(c).trim() !== "").length
    if (filled >= 3) { headerRowIdx = i; break }
  }

  const headers = raw[headerRowIdx].map((h: any) => String(h).trim())

  const mapping: ColumnMapping = {
    date:        detectCol(headers, "date"),
    description: detectCol(headers, "description"),
    debit:       detectCol(headers, "debit"),
    credit:      detectCol(headers, "credit"),
    balance:     detectCol(headers, "balance"),
    amount:      detectCol(headers, "amount"),
  }

  if (mapping.date === -1) errors.push("تعذّر تحديد عمود التاريخ — يرجى التحقق من ترويسات الملف")
  if (mapping.description === -1) errors.push("تعذّر تحديد عمود الوصف")

  const rows: ParsedRow[] = []

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i]
    const dateVal = mapping.date !== -1 ? row[mapping.date] : ""
    const dateStr = parseDate(dateVal)
    if (!dateStr) continue                     // skip rows with no valid date

    const desc = mapping.description !== -1 ? String(row[mapping.description] || "").trim() : ""

    let debit  = mapping.debit  !== -1 ? parseNum(row[mapping.debit])  : 0
    let credit = mapping.credit !== -1 ? parseNum(row[mapping.credit]) : 0

    // Single-amount column: negative = debit, positive = credit
    if (mapping.amount !== -1 && debit === 0 && credit === 0) {
      const amt = parseNum(row[mapping.amount])
      if (amt < 0) debit  = round2(Math.abs(amt))
      else         credit = amt
    }

    const balance = mapping.balance !== -1 ? parseNum(row[mapping.balance]) : 0

    const rawObj: Record<string, string> = {}
    headers.forEach((h, idx) => { rawObj[h] = String(row[idx] || "") })

    rows.push({ date: dateStr, description: desc, debit, credit, balance, raw: rawObj })
  }

  return { rows, headers, mapping, errors }
}

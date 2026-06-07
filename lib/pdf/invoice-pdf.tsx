import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer"
import path from "path"

Font.register({
  family: "NotoSansArabic",
  src: path.join(process.cwd(), "public/fonts/NotoSansArabic.ttf"),
})

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansArabic",
    backgroundColor: "#ffffff",
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontSize: 10,
    color: "#1a1a1a",
  },
  // ── Header ──
  header: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 28 },
  orgBlock: { alignItems: "flex-end" },
  orgName: { fontSize: 18, fontFamily: "NotoSansArabic", color: "#1e40af", marginBottom: 3 },
  orgMeta: { fontSize: 9, color: "#6b7280", marginBottom: 2, textAlign: "right" },
  titleBlock: { alignItems: "flex-start" },
  invoiceTitle: { fontSize: 22, fontFamily: "NotoSansArabic", color: "#1e40af" },
  invoiceNumber: { fontSize: 12, color: "#374151", marginTop: 4 },
  // ── Divider ──
  divider: { borderBottomWidth: 2, borderBottomColor: "#1e40af", marginBottom: 18 },
  dividerThin: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginBottom: 14 },
  // ── Party rows ──
  parties: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 18 },
  partyBlock: { width: "45%" },
  partyLabel: { fontSize: 8, color: "#9ca3af", marginBottom: 4, textAlign: "right" },
  partyName: { fontSize: 12, fontFamily: "NotoSansArabic", color: "#111827", textAlign: "right", marginBottom: 2 },
  partyMeta: { fontSize: 9, color: "#6b7280", textAlign: "right", marginBottom: 1 },
  datesBlock: { width: "35%", alignItems: "flex-end" },
  dateRow: { flexDirection: "row-reverse", justifyContent: "space-between", width: "100%", marginBottom: 4 },
  dateLabel: { fontSize: 9, color: "#9ca3af" },
  dateValue: { fontSize: 9, color: "#111827" },
  // ── Status badge ──
  badge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, marginTop: 4, alignSelf: "flex-end" },
  badgeText: { fontSize: 9, fontFamily: "NotoSansArabic" },
  // ── Table ──
  tableHeader: { flexDirection: "row-reverse", backgroundColor: "#1e40af", paddingVertical: 7, paddingHorizontal: 10, borderRadius: 4, marginBottom: 2 },
  tableHeaderText: { fontSize: 9, color: "#ffffff", fontFamily: "NotoSansArabic", textAlign: "center" },
  tableRow: { flexDirection: "row-reverse", paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  cellText: { fontSize: 9, color: "#374151", textAlign: "center" },
  colIndex: { width: "5%" },
  colDesc:  { width: "38%" },
  colQty:   { width: "10%" },
  colPrice: { width: "15%" },
  colTax:   { width: "14%" },
  colTotal: { width: "18%" },
  colDescNoTax: { width: "46%" },
  colTotalNoTax: { width: "21%" },
  // ── Totals ──
  totalsRow: { flexDirection: "row-reverse", justifyContent: "flex-start", paddingVertical: 5, paddingHorizontal: 10 },
  totalsLabel: { width: "60%", textAlign: "right", fontSize: 10, color: "#374151" },
  totalsValue: { width: "20%", textAlign: "left", fontSize: 10, color: "#374151" },
  totalsGrandLabel: { width: "60%", textAlign: "right", fontSize: 12, fontFamily: "NotoSansArabic", color: "#1e40af" },
  totalsGrandValue: { width: "20%", textAlign: "left", fontSize: 12, fontFamily: "NotoSansArabic", color: "#1e40af" },
  totalsGrandRow: { flexDirection: "row-reverse", justifyContent: "flex-start", paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#eff6ff", borderRadius: 4, marginTop: 4 },
  // ── Notes ──
  notesBox: { marginTop: 20, padding: 12, backgroundColor: "#f9fafb", borderRadius: 4, borderLeftWidth: 3, borderLeftColor: "#1e40af" },
  notesLabel: { fontSize: 9, color: "#9ca3af", marginBottom: 4, textAlign: "right" },
  notesText: { fontSize: 9, color: "#374151", textAlign: "right" },
  // ── Footer ──
  footer: { position: "absolute", bottom: 25, left: 40, right: 40, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 8, color: "#9ca3af" },
  pageNum: { fontSize: 8, color: "#9ca3af" },
})

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  DRAFT:     { label: "مسودة",           bg: "#f3f4f6", color: "#6b7280" },
  SENT:      { label: "مرسلة",           bg: "#dbeafe", color: "#1d4ed8" },
  PARTIAL:   { label: "مدفوع جزئياً",    bg: "#fef9c3", color: "#92400e" },
  PAID:      { label: "مدفوعة",          bg: "#dcfce7", color: "#15803d" },
  OVERDUE:   { label: "متأخرة",          bg: "#fee2e2", color: "#dc2626" },
  CANCELLED: { label: "ملغاة",           bg: "#f3f4f6", color: "#9ca3af" },
  CREDIT_NOTE: { label: "إشعار خصم",    bg: "#fce7f3", color: "#9d174d" },
}

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
}

export interface InvoicePDFProps {
  invoice: {
    number: string
    date: Date | string
    dueDate: Date | string
    status: string
    subtotal: number
    discountAmount: number
    taxAmount: number
    total: number
    amountPaid: number
    amountDue: number
    notes?: string | null
    terms?: string | null
    items: {
      description: string
      quantity: number
      unitPrice: number
      taxAmount: number
      total: number
      taxRate?: { rate: number; name: string } | null
    }[]
    contact: {
      name: string
      email?: string | null
      phone?: string | null
      address?: string | null
      taxNumber?: string | null
    }
  }
  org: {
    name: string
    address?: string | null
    phone?: string | null
    email?: string | null
    taxNumber?: string | null
    country: string
  }
  currencySymbol: string
  invoiceTitle: string
  vatName?: string
}

export function InvoicePDF({ invoice, org, currencySymbol, invoiceTitle, vatName }: InvoicePDFProps) {
  const hasVat     = Number(invoice.taxAmount) > 0
  const hasDiscount = Number(invoice.discountAmount) > 0
  const statusCfg  = STATUS_LABELS[invoice.status] || STATUS_LABELS.DRAFT
  const isOverdue  = new Date(invoice.dueDate) < new Date() && ["SENT", "PARTIAL"].includes(invoice.status)
  const displayCfg = isOverdue ? STATUS_LABELS.OVERDUE : statusCfg

  return (
    <Document title={`${invoiceTitle} ${invoice.number}`} author={org.name}>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.orgBlock}>
            <Text style={s.orgName}>{org.name}</Text>
            {org.address    && <Text style={s.orgMeta}>{org.address}</Text>}
            {org.phone      && <Text style={s.orgMeta}>{org.phone}</Text>}
            {org.email      && <Text style={s.orgMeta}>{org.email}</Text>}
            {org.taxNumber  && <Text style={s.orgMeta}>الرقم الضريبي: {org.taxNumber}</Text>}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.invoiceTitle}>{invoiceTitle}</Text>
            <Text style={s.invoiceNumber}>{invoice.number}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Parties + Dates ── */}
        <View style={s.parties}>
          <View style={s.partyBlock}>
            <Text style={s.partyLabel}>فاتورة إلى</Text>
            <Text style={s.partyName}>{invoice.contact.name}</Text>
            {invoice.contact.taxNumber && <Text style={s.partyMeta}>رقم ضريبي: {invoice.contact.taxNumber}</Text>}
            {invoice.contact.address   && <Text style={s.partyMeta}>{invoice.contact.address}</Text>}
            {invoice.contact.phone     && <Text style={s.partyMeta}>{invoice.contact.phone}</Text>}
            {invoice.contact.email     && <Text style={s.partyMeta}>{invoice.contact.email}</Text>}
          </View>
          <View style={s.datesBlock}>
            <View style={s.dateRow}>
              <Text style={s.dateLabel}>تاريخ الفاتورة</Text>
              <Text style={s.dateValue}>{fmtDate(invoice.date)}</Text>
            </View>
            <View style={s.dateRow}>
              <Text style={s.dateLabel}>تاريخ الاستحقاق</Text>
              <Text style={[s.dateValue, isOverdue ? { color: "#dc2626" } : {}]}>{fmtDate(invoice.dueDate)}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: displayCfg.bg }]}>
              <Text style={[s.badgeText, { color: displayCfg.color }]}>{displayCfg.label}</Text>
            </View>
          </View>
        </View>

        <View style={s.dividerThin} />

        {/* ── Items Table ── */}
        <View style={[s.tableHeader]}>
          <Text style={[s.tableHeaderText, s.colIndex]}>#</Text>
          <Text style={[s.tableHeaderText, hasVat ? s.colDesc : s.colDescNoTax]}>الوصف</Text>
          <Text style={[s.tableHeaderText, s.colQty]}>الكمية</Text>
          <Text style={[s.tableHeaderText, s.colPrice]}>سعر الوحدة</Text>
          {hasVat && <Text style={[s.tableHeaderText, s.colTax]}>الضريبة</Text>}
          <Text style={[s.tableHeaderText, hasVat ? s.colTotal : s.colTotalNoTax]}>الإجمالي</Text>
        </View>

        {invoice.items.map((item, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={[s.cellText, s.colIndex]}>{i + 1}</Text>
            <Text style={[s.cellText, hasVat ? s.colDesc : s.colDescNoTax, { textAlign: "right" }]}>{item.description}</Text>
            <Text style={[s.cellText, s.colQty]}>{Number(item.quantity).toFixed(2)}</Text>
            <Text style={[s.cellText, s.colPrice]}>{fmt(Number(item.unitPrice), currencySymbol)}</Text>
            {hasVat && (
              <Text style={[s.cellText, s.colTax]}>
                {item.taxRate ? `${Number(item.taxRate.rate)}%` : "-"}
              </Text>
            )}
            <Text style={[s.cellText, hasVat ? s.colTotal : s.colTotalNoTax, { fontFamily: "NotoSansArabic" }]}>
              {fmt(Number(item.total), currencySymbol)}
            </Text>
          </View>
        ))}

        {/* ── Totals ── */}
        <View style={{ marginTop: 12, marginRight: 0 }}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>المجموع الفرعي</Text>
            <Text style={s.totalsValue}>{fmt(Number(invoice.subtotal), currencySymbol)}</Text>
          </View>
          {hasDiscount && (
            <View style={s.totalsRow}>
              <Text style={[s.totalsLabel, { color: "#059669" }]}>الخصم</Text>
              <Text style={[s.totalsValue, { color: "#059669" }]}>- {fmt(Number(invoice.discountAmount), currencySymbol)}</Text>
            </View>
          )}
          {hasVat && (
            <View style={s.totalsRow}>
              <Text style={[s.totalsLabel, { color: "#d97706" }]}>{vatName || "ضريبة القيمة المضافة"}</Text>
              <Text style={[s.totalsValue, { color: "#d97706" }]}>{fmt(Number(invoice.taxAmount), currencySymbol)}</Text>
            </View>
          )}
          <View style={s.totalsGrandRow}>
            <Text style={s.totalsGrandLabel}>الإجمالي النهائي</Text>
            <Text style={s.totalsGrandValue}>{fmt(Number(invoice.total), currencySymbol)}</Text>
          </View>
          {Number(invoice.amountPaid) > 0 && (
            <>
              <View style={s.totalsRow}>
                <Text style={[s.totalsLabel, { color: "#059669" }]}>المبلغ المدفوع</Text>
                <Text style={[s.totalsValue, { color: "#059669" }]}>{fmt(Number(invoice.amountPaid), currencySymbol)}</Text>
              </View>
              <View style={s.totalsRow}>
                <Text style={[s.totalsLabel, { color: "#dc2626", fontFamily: "NotoSansArabic" }]}>المبلغ المستحق</Text>
                <Text style={[s.totalsValue, { color: "#dc2626", fontFamily: "NotoSansArabic" }]}>{fmt(Number(invoice.amountDue), currencySymbol)}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Notes / Terms ── */}
        {(invoice.notes || invoice.terms) && (
          <View style={s.notesBox}>
            {invoice.notes && (
              <>
                <Text style={s.notesLabel}>ملاحظات</Text>
                <Text style={s.notesText}>{invoice.notes}</Text>
              </>
            )}
            {invoice.terms && (
              <>
                <Text style={[s.notesLabel, { marginTop: invoice.notes ? 8 : 0 }]}>شروط الدفع</Text>
                <Text style={s.notesText}>{invoice.terms}</Text>
              </>
            )}
          </View>
        )}

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{org.name} · {invoiceTitle} {invoice.number}</Text>
          <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}

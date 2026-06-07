import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { getCountry } from "@/lib/countries"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import PrintActions from "@/components/invoice/print-actions"
import { buildZatcaTlv } from "@/lib/zatca"
import QRCode from "qrcode"

export default async function InvoicePrintPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/login")

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { contact: true, items: { include: { taxRate: true } } },
  })
  if (!invoice) notFound()

  const org = userOrg.organization
  const country = getCountry(org.country)
  const fmt = (n: number) => formatCurrency(n, country.currency, country.locale)

  const isOverdue = invoice.dueDate < new Date() && ["SENT", "PARTIAL"].includes(invoice.status)
  const hasVat = country.vatEnabled && Number(invoice.taxAmount) > 0
  const invoiceTitle = country.vatEnabled ? "فاتورة ضريبية" : "فاتورة"

  // ZATCA QR Code (Saudi Arabia and other VAT countries)
  let zatcaQrDataUrl: string | null = null
  if (country.vatEnabled && org.taxNumber) {
    try {
      const tlv = buildZatcaTlv({
        sellerName: org.name,
        vatNumber: org.taxNumber,
        invoiceDate: invoice.date,
        invoiceTotal: Number(invoice.total),
        vatAmount: Number(invoice.taxAmount),
      })
      zatcaQrDataUrl = await QRCode.toDataURL(tlv, {
        type: "image/png",
        width: 150,
        margin: 1,
        errorCorrectionLevel: "M",
      })
    } catch { /* skip QR if generation fails */ }
  }

  const statusMap: Record<string, string> = {
    DRAFT: "مسودة", SENT: "مرسلة", PARTIAL: "مدفوع جزئياً",
    PAID: "مدفوعة", OVERDUE: "متأخرة", CANCELLED: "ملغاة",
  }
  const displayStatus = isOverdue ? "OVERDUE" : invoice.status

  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{invoiceTitle} {invoice.number} — {org.name}</title>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: 'Cairo', sans-serif;
            direction: rtl;
            background: #f5f5f5;
            color: #1a1a1a;
            font-size: 14px;
          }

          .print-actions {
            background: #1e40af;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .invoice-page {
            max-width: 794px;
            margin: 24px auto;
            background: #fff;
            box-shadow: 0 4px 24px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
          }

          .invoice-header {
            background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
            color: white;
            padding: 36px 40px;
          }

          .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .org-name { font-size: 24px; font-weight: 900; margin-bottom: 4px; }
          .org-detail { font-size: 12px; color: #93c5fd; margin-top: 3px; }

          .invoice-label { font-size: 28px; font-weight: 900; text-align: left; }
          .invoice-number { font-size: 16px; color: #bfdbfe; font-family: monospace; text-align: left; margin-top: 4px; }
          .country-badge { font-size: 12px; color: #93c5fd; text-align: left; margin-top: 4px; }

          .invoice-body { padding: 32px 40px; }

          .meta-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 2px solid #e5e7eb;
          }

          .bill-to-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
          .contact-name { font-size: 18px; font-weight: 700; }
          .contact-detail { font-size: 12px; color: #6b7280; margin-top: 3px; }

          .dates-section { text-align: left; }
          .date-row { margin-bottom: 8px; }
          .date-label { font-size: 11px; color: #6b7280; }
          .date-value { font-size: 14px; font-weight: 600; }
          .date-value.overdue { color: #dc2626; }

          .status-badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 8px;
          }
          .status-PAID { background: #dcfce7; color: #16a34a; }
          .status-SENT { background: #dbeafe; color: #1d4ed8; }
          .status-PARTIAL { background: #fef9c3; color: #ca8a04; }
          .status-OVERDUE { background: #fee2e2; color: #dc2626; }
          .status-DRAFT { background: #f3f4f6; color: #6b7280; }
          .status-CANCELLED { background: #f3f4f6; color: #9ca3af; }

          table { width: 100%; border-collapse: collapse; }

          th {
            background: #f8fafc;
            padding: 12px 10px;
            font-size: 12px;
            font-weight: 700;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
            text-align: right;
          }

          th:last-child, td:last-child { text-align: left; }

          td {
            padding: 11px 10px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 13px;
            vertical-align: top;
          }

          .item-desc { font-weight: 600; }
          .item-detail { font-size: 11px; color: #9ca3af; margin-top: 2px; }

          .totals-section {
            margin-top: 16px;
            display: flex;
            justify-content: flex-end;
          }

          .totals-table { min-width: 280px; }

          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 7px 0;
            font-size: 13px;
            border-bottom: 1px solid #f1f5f9;
          }
          .total-row:last-child { border-bottom: none; }
          .total-row.grand {
            font-size: 16px; font-weight: 900;
            background: #eff6ff; padding: 12px 16px;
            border-radius: 8px; margin-top: 8px;
            border-bottom: none; color: #1e40af;
          }
          .total-row.tax-row { color: #d97706; }

          .notes-section {
            margin-top: 24px;
            padding: 16px;
            background: #f8fafc;
            border-radius: 8px;
            border-right: 4px solid #3b82f6;
          }
          .notes-label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 6px; }
          .notes-text { font-size: 13px; color: #374151; line-height: 1.6; }

          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .footer-brand { font-size: 11px; color: #9ca3af; }
          .footer-brand span { color: #3b82f6; font-weight: 700; }
          .payment-info { font-size: 11px; color: #6b7280; text-align: left; }

          .zatca-section {
            margin-top: 24px;
            padding: 16px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 20px;
          }
          .zatca-qr img { width: 120px; height: 120px; }
          .zatca-text { font-size: 11px; color: #15803d; }
          .zatca-text strong { font-size: 12px; display: block; margin-bottom: 4px; }
          .zatca-tlv {
            font-family: monospace;
            font-size: 9px;
            color: #6b7280;
            word-break: break-all;
            margin-top: 6px;
            max-width: 400px;
          }

          @media print {
            body { background: white; }
            .print-actions { display: none !important; }
            .invoice-page {
              margin: 0; box-shadow: none; border-radius: 0;
              max-width: 100%;
            }
            @page { size: A4; margin: 0; }
          }
        `}</style>
      </head>
      <body>
        {/* Action bar — hidden on print */}
        <PrintActions invoiceNumber={invoice.number} backUrl={`/dashboard/invoices/${params.id}`} />

        {/* Invoice */}
        <div className="invoice-page">
          {/* Header */}
          <div className="invoice-header">
            <div className="header-top">
              <div>
                <div className="org-name">{org.name}</div>
                {org.address && <div className="org-detail">{org.address}</div>}
                {org.phone && <div className="org-detail">{org.phone}</div>}
                {org.email && <div className="org-detail">{org.email}</div>}
                {org.taxNumber && (
                  <div className="org-detail">
                    {country.zatcaRequired ? "الرقم الضريبي ZATCA: " : country.ftaRequired ? "رقم TRN: " : "الرقم الضريبي: "}
                    {org.taxNumber}
                  </div>
                )}
              </div>
              <div>
                <div className="invoice-label">{invoiceTitle}</div>
                <div className="invoice-number">{invoice.number}</div>
                <div className="country-badge">{country.flag} {country.nameAr} · {country.currencySymbol}</div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="invoice-body">
            {/* Meta */}
            <div className="meta-section">
              <div>
                <div className="bill-to-label">فاتورة إلى</div>
                <div className="contact-name">{invoice.contact.name}</div>
                {invoice.contact.taxNumber && <div className="contact-detail">رقم ضريبي: {invoice.contact.taxNumber}</div>}
                {invoice.contact.address && <div className="contact-detail">{invoice.contact.address}</div>}
                {invoice.contact.phone && <div className="contact-detail">{invoice.contact.phone}</div>}
                {invoice.contact.email && <div className="contact-detail">{invoice.contact.email}</div>}
              </div>
              <div className="dates-section">
                <div className="date-row">
                  <div className="date-label">تاريخ الفاتورة</div>
                  <div className="date-value">{formatDateShort(invoice.date)}</div>
                </div>
                <div className="date-row">
                  <div className="date-label">تاريخ الاستحقاق</div>
                  <div className={`date-value ${isOverdue ? "overdue" : ""}`}>{formatDateShort(invoice.dueDate)}</div>
                </div>
                <div className={`status-badge status-${displayStatus}`}>
                  {statusMap[displayStatus] || displayStatus}
                </div>
              </div>
            </div>

            {/* Items */}
            <table>
              <thead>
                <tr>
                  <th style={{ width: "32px" }}>#</th>
                  <th>الوصف</th>
                  <th style={{ textAlign: "left", width: "80px" }}>الكمية</th>
                  <th style={{ textAlign: "left", width: "110px" }}>سعر الوحدة</th>
                  {hasVat && <th style={{ textAlign: "left", width: "100px" }}>الضريبة</th>}
                  <th style={{ textAlign: "left", width: "120px" }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={item.id}>
                    <td style={{ color: "#9ca3af", fontSize: "12px" }}>{i + 1}</td>
                    <td>
                      <div className="item-desc">{item.description}</div>
                    </td>
                    <td style={{ textAlign: "left" }}>{Number(item.quantity).toFixed(2)}</td>
                    <td style={{ textAlign: "left" }}>{fmt(Number(item.unitPrice))}</td>
                    {hasVat && (
                      <td style={{ textAlign: "left", fontSize: "12px", color: "#d97706" }}>
                        {item.taxRate ? `${Number(item.taxRate.rate)}%` : "—"}
                        {item.taxAmount && Number(item.taxAmount) > 0 ? ` (${fmt(Number(item.taxAmount))})` : ""}
                      </td>
                    )}
                    <td style={{ textAlign: "left", fontWeight: "600" }}>{fmt(Number(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="totals-section">
              <div className="totals-table">
                <div className="total-row">
                  <span>المجموع الفرعي</span>
                  <span>{fmt(Number(invoice.subtotal))}</span>
                </div>
                {hasVat && (
                  <div className="total-row tax-row">
                    <span>{country.vatName}</span>
                    <span>{fmt(Number(invoice.taxAmount))}</span>
                  </div>
                )}
                {Number(invoice.amountPaid) > 0 && (
                  <div className="total-row" style={{ color: "#16a34a" }}>
                    <span>المدفوع</span>
                    <span>- {fmt(Number(invoice.amountPaid))}</span>
                  </div>
                )}
                <div className="total-row grand">
                  <span>{Number(invoice.amountPaid) > 0 ? "المتبقي" : "الإجمالي النهائي"}</span>
                  <span>{fmt(Number(invoice.amountPaid) > 0 ? Number(invoice.amountDue) : Number(invoice.total))}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="notes-section" style={{ marginTop: "24px" }}>
                <div className="notes-label">ملاحظات</div>
                <div className="notes-text">{invoice.notes}</div>
              </div>
            )}

            {/* ZATCA QR Code */}
            {zatcaQrDataUrl && (
              <div className="zatca-section">
                <div className="zatca-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={zatcaQrDataUrl} alt="ZATCA QR Code" />
                </div>
                <div className="zatca-text">
                  <strong>رمز الاستجابة السريعة (ZATCA)</strong>
                  <div>هذا الرمز مستوفٍ لمتطلبات هيئة الزكاة والضريبة والجمارك</div>
                  {country.zatcaRequired && (
                    <div style={{ marginTop: "4px" }}>
                      الرقم الضريبي: {org.taxNumber}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="footer">
              <div className="footer-brand">
                تم الإنشاء بواسطة <span>HesabPro</span> — النظام المحاسبي الذكي
              </div>
              <div className="payment-info">
                {org.email && <div>للاستفسار: {org.email}</div>}
                {org.phone && <div>{org.phone}</div>}
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

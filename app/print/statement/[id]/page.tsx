import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCountry } from "@/lib/countries"
import { round2 } from "@/lib/accounting"

const TXN_LABEL: Record<string, string> = {
  INVOICE:     "فاتورة",
  CREDIT_NOTE: "إشعار خصم",
  PAYMENT:     "دفعة مستلمة",
  BILL:        "فاتورة مورد",
  DEBIT_NOTE:  "إشعار إضافة",
  PAYMENT_OUT: "دفعة مدفوعة",
}

export default async function PrintStatementPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { from?: string; to?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) redirect("/onboarding")

  const orgId = userOrg.organizationId
  const now = new Date()
  const from = searchParams.from ? new Date(searchParams.from) : new Date(now.getFullYear(), 0, 1)
  const to   = searchParams.to   ? new Date(searchParams.to)   : now
  to.setHours(23, 59, 59, 999)

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true, name: true, email: true, phone: true, address: true, taxNumber: true, type: true },
  })
  if (!contact) redirect("/dashboard/contacts/customers")

  const org = userOrg.organization
  const country = getCountry(org.country)
  const currency = org.baseCurrency || country.currency
  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Build transactions (same logic as API)
  type Txn = { id: string; date: Date; type: string; number: string; description: string; debit: number; credit: number }
  const allTxns: Txn[] = []

  const isCustomer = contact.type !== "VENDOR"
  const isVendor   = contact.type !== "CUSTOMER"

  if (isCustomer) {
    const invs = await prisma.invoice.findMany({ where: { organizationId: orgId, contactId: params.id, type: "INVOICE" }, select: { id: true, number: true, date: true, total: true } })
    invs.forEach((i) => allTxns.push({ id: i.id, date: i.date, type: "INVOICE",     number: i.number, description: `فاتورة ${i.number}`, debit: Number(i.total), credit: 0 }))

    const cns = await prisma.invoice.findMany({ where: { organizationId: orgId, contactId: params.id, type: "CREDIT_NOTE" }, select: { id: true, number: true, date: true, total: true } })
    cns.forEach((c) => allTxns.push({ id: c.id, date: c.date, type: "CREDIT_NOTE", number: c.number, description: `إشعار خصم ${c.number}`, debit: 0, credit: Number(c.total) }))

    const pays = await prisma.payment.findMany({ where: { organizationId: orgId, contactId: params.id, type: "INCOMING" }, select: { id: true, date: true, amount: true, reference: true } })
    pays.forEach((p) => allTxns.push({ id: p.id, date: p.date, type: "PAYMENT",     number: p.reference || p.id.slice(-6).toUpperCase(), description: `دفعة مستلمة`, debit: 0, credit: Number(p.amount) }))
  }

  if (isVendor) {
    const bills = await prisma.bill.findMany({ where: { organizationId: orgId, contactId: params.id, type: "BILL" }, select: { id: true, number: true, date: true, total: true } })
    bills.forEach((b) => allTxns.push({ id: b.id, date: b.date, type: "BILL",       number: b.number, description: `فاتورة مورد ${b.number}`, debit: 0, credit: Number(b.total) }))

    const dns = await prisma.bill.findMany({ where: { organizationId: orgId, contactId: params.id, type: "DEBIT_NOTE" }, select: { id: true, number: true, date: true, total: true } })
    dns.forEach((d) => allTxns.push({ id: d.id, date: d.date, type: "DEBIT_NOTE",   number: d.number, description: `إشعار إضافة ${d.number}`, debit: Number(d.total), credit: 0 }))

    const pays = await prisma.payment.findMany({ where: { organizationId: orgId, contactId: params.id, type: "OUTGOING" }, select: { id: true, date: true, amount: true, reference: true } })
    pays.forEach((p) => allTxns.push({ id: p.id, date: p.date, type: "PAYMENT_OUT", number: p.reference || p.id.slice(-6).toUpperCase(), description: `دفعة مدفوعة`, debit: Number(p.amount), credit: 0 }))
  }

  allTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const openingBalance = round2(
    allTxns.filter((t) => new Date(t.date) < from).reduce((s, t) => s + t.debit - t.credit, 0)
  )
  const periodTxns = allTxns.filter((t) => new Date(t.date) >= from && new Date(t.date) <= to)

  let running = openingBalance
  const transactions = periodTxns.map((t) => {
    running = round2(running + t.debit - t.credit)
    return { ...t, balance: running }
  })

  const totalDebit  = round2(periodTxns.reduce((s, t) => s + t.debit,  0))
  const totalCredit = round2(periodTxns.reduce((s, t) => s + t.credit, 0))

  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <title>كشف حساب — {contact.name}</title>
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: white; padding: 24px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .company { font-size: 18px; font-weight: bold; }
          .title-block { text-align: left; }
          .title-block h1 { font-size: 20px; font-weight: bold; color: #2563eb; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; }
          .info-label { color: #6b7280; font-size: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { background: #1e3a8a; color: white; padding: 7px 10px; text-align: right; font-size: 11px; }
          th.num { text-align: left; }
          td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
          td.num { text-align: left; font-family: monospace; }
          tr:nth-child(even) { background: #f9fafb; }
          .opening { background: #f0f9ff !important; font-weight: 600; }
          .totals { background: #e5e7eb !important; font-weight: bold; }
          .closing { background: #dbeafe !important; font-weight: bold; font-size: 12px; }
          .balance-due { color: #dc2626; }
          .balance-credit { color: #16a34a; }
          .badge { display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 10px; }
          .footer { margin-top: 24px; text-align: center; color: #9ca3af; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
          @media print { body { padding: 0; } @page { margin: 15mm; } }
        ` }} />
      </head>
      <body>
        {/* Header */}
        <div className="header">
          <div>
            <div className="company">{org.name}</div>
            {org.address && <div style={{ color: "#6b7280", fontSize: 11 }}>{org.address}</div>}
            {org.phone   && <div style={{ color: "#6b7280", fontSize: 11 }}>{org.phone}</div>}
            {org.taxNumber && <div style={{ color: "#6b7280", fontSize: 11 }}>الرقم الضريبي: {org.taxNumber}</div>}
          </div>
          <div className="title-block">
            <h1>كشف الحساب</h1>
            <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
              من {from.toLocaleDateString("ar-SA")} إلى {to.toLocaleDateString("ar-SA")}
            </div>
            <div style={{ color: "#6b7280", fontSize: 11 }}>العملة: {currency}</div>
          </div>
        </div>

        {/* Contact info */}
        <div className="info-grid">
          <div>
            <div className="info-label">صادر إلى</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{contact.name}</div>
            {contact.phone && <div style={{ color: "#6b7280" }}>{contact.phone}</div>}
            {contact.email && <div style={{ color: "#6b7280" }}>{contact.email}</div>}
            {contact.taxNumber && <div style={{ color: "#6b7280" }}>الرقم الضريبي: {contact.taxNumber}</div>}
          </div>
          <div style={{ textAlign: "left" }}>
            <div className="info-label">الرصيد الختامي</div>
            <div style={{ fontSize: 22, fontWeight: "bold", marginTop: 2 }}
              className={running > 0 ? "balance-due" : running < 0 ? "balance-credit" : ""}>
              {fmt(Math.abs(running))} {currency}
            </div>
            <div style={{ color: "#6b7280", fontSize: 10 }}>
              {running > 0 ? "مستحق على العميل" : running < 0 ? "رصيد لصالح العميل" : "لا يوجد رصيد"}
            </div>
          </div>
        </div>

        {/* Table */}
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>الرقم</th>
              <th>البيان</th>
              <th className="num">مدين</th>
              <th className="num">دائن</th>
              <th className="num">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            <tr className="opening">
              <td colSpan={4}>رصيد أول المدة</td>
              <td className="num"></td>
              <td className="num"></td>
              <td className={`num ${openingBalance > 0 ? "balance-due" : openingBalance < 0 ? "balance-credit" : ""}`}>
                {openingBalance !== 0 ? `${fmt(Math.abs(openingBalance))} ${openingBalance > 0 ? "مدين" : "دائن"}` : "—"}
              </td>
            </tr>

            {transactions.map((txn, i) => (
              <tr key={i}>
                <td>{new Date(txn.date).toLocaleDateString("ar-SA")}</td>
                <td>{TXN_LABEL[txn.type] || txn.type}</td>
                <td style={{ fontFamily: "monospace" }}>{txn.number}</td>
                <td>{txn.description}</td>
                <td className="num">{txn.debit  > 0 ? fmt(txn.debit)  : ""}</td>
                <td className="num" style={{ color: "#16a34a" }}>{txn.credit > 0 ? fmt(txn.credit) : ""}</td>
                <td className={`num ${txn.balance > 0 ? "balance-due" : txn.balance < 0 ? "balance-credit" : ""}`}>
                  {txn.balance !== 0 ? fmt(Math.abs(txn.balance)) : "—"}
                </td>
              </tr>
            ))}

            {transactions.length > 0 && (
              <>
                <tr className="totals">
                  <td colSpan={4}>إجمالي الفترة</td>
                  <td className="num">{fmt(totalDebit)}</td>
                  <td className="num" style={{ color: "#16a34a" }}>{fmt(totalCredit)}</td>
                  <td></td>
                </tr>
                <tr className="closing">
                  <td colSpan={4}>رصيد آخر المدة</td>
                  <td></td>
                  <td></td>
                  <td className={`num ${running > 0 ? "balance-due" : running < 0 ? "balance-credit" : ""}`}>
                    {fmt(Math.abs(running))} {running > 0 ? "مدين" : running < 0 ? "دائن" : ""}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        <div className="footer">
          تم إنشاء هذا الكشف بواسطة HesabPro · {new Date().toLocaleDateString("ar-SA")}
        </div>

        <script dangerouslySetInnerHTML={{ __html: "window.onload = () => window.print()" }} />
      </body>
    </html>
  )
}

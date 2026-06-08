import { prisma } from "./prisma"
import { getCountry } from "./countries"

// Scale amounts by country currency
function amounts(countryCode: string) {
  // Returns a multiplier so numbers feel natural per country
  const scale: Record<string, number> = {
    IQ: 1000,   // IQD: millions
    SA: 1,      // SAR: thousands
    AE: 1,      // AED: thousands
    KW: 0.3,    // KWD: hundreds
    BH: 0.4,    // BHD
    QA: 0.9,    // QAR
    OM: 0.4,    // OMR
    JO: 0.7,    // JOD
    EG: 3,      // EGP: higher numbers
    LY: 0.5,
    SY: 200,
    YE: 250,
  }
  return scale[countryCode] ?? 1
}

function d(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

export async function seedDemoData(organizationId: string): Promise<{ created: number }> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!org) throw new Error("Organization not found")

  // Check if demo data already exists
  const existing = await prisma.contact.count({ where: { organizationId } })
  if (existing > 0) return { created: 0 }

  const country = getCountry(org.country)
  const M = amounts(org.country)
  const currency = country.currency

  // ── 1. Get seeded accounts ───────────────────────────────────
  const accounts = await prisma.account.findMany({
    where: { organizationId },
    select: { id: true, accountType: true, code: true },
  })

  const acc = (type: string) => accounts.find((a) => a.accountType === type)?.id
  const accByCode = (code: string) => accounts.find((a) => a.code === code)?.id

  const cashId      = acc("CASH")!
  const bankId      = acc("BANK")!
  const arId        = acc("ACCOUNTS_RECEIVABLE")!
  const apId        = acc("ACCOUNTS_PAYABLE")!
  const revenueId   = accByCode("4010")!
  const serviceId   = accByCode("4020")!
  const cogsId      = accByCode("5010")!
  const salariesId  = accByCode("5110")!
  const rentId      = accByCode("5120")!
  const utilityId   = accByCode("5130")!
  const otherExpId  = accByCode("5170")!
  const taxId       = acc("TAX")

  if (!cashId || !bankId || !arId || !apId || !revenueId) {
    throw new Error("Default accounts not found — ensure org is fully seeded")
  }

  // ── 2. Tax rate ──────────────────────────────────────────────
  const taxRate = country.vatEnabled
    ? await prisma.taxRate.findFirst({ where: { organizationId } })
    : null

  // ── 3. Contacts ──────────────────────────────────────────────
  const customersData = [
    { name: "شركة البيان للتجارة",            phone: `${country.phonePrefix}501234567`, type: "CUSTOMER" },
    { name: "مؤسسة النهرين للمواد الغذائية",  phone: `${country.phonePrefix}502345678`, type: "CUSTOMER" },
    { name: "شركة الرافدين للخدمات",          phone: `${country.phonePrefix}503456789`, type: "CUSTOMER" },
    { name: "مجموعة الأمل التجارية",           phone: `${country.phonePrefix}504567890`, type: "CUSTOMER" },
  ]
  const suppliersData = [
    { name: "شركة الخليج للاستيراد",          phone: `${country.phonePrefix}505678901`, type: "VENDOR" },
    { name: "مستودع البغدادي للتوزيع",         phone: `${country.phonePrefix}506789012`, type: "VENDOR" },
    { name: "شركة الأمانة للتوريدات",          phone: `${country.phonePrefix}507890123`, type: "VENDOR" },
  ]

  const customers = await Promise.all(
    customersData.map((c) =>
      prisma.contact.create({ data: { organizationId, name: c.name, phone: c.phone, type: "CUSTOMER", isActive: true } })
    )
  )
  const suppliers = await Promise.all(
    suppliersData.map((s) =>
      prisma.contact.create({ data: { organizationId, name: s.name, phone: s.phone, type: "VENDOR", isActive: true } })
    )
  )

  // ── 4. Products ──────────────────────────────────────────────
  await prisma.product.createMany({
    data: [
      { organizationId, name: "مواد غذائية متنوعة",   code: "PRD-001", salePrice: 500 * M,  purchasePrice: 350 * M,  isInventoried: true,  isActive: true },
      { organizationId, name: "إلكترونيات ومعدات",    code: "PRD-002", salePrice: 2000 * M, purchasePrice: 1500 * M, isInventoried: true,  isActive: true },
      { organizationId, name: "خدمة استشارية",         code: "SRV-001", salePrice: 1000 * M, purchasePrice: 0,        isInventoried: false, isActive: true },
      { organizationId, name: "خدمة توصيل وشحن",      code: "SRV-002", salePrice: 200 * M,  purchasePrice: 100 * M,  isInventoried: false, isActive: true },
      { organizationId, name: "مواد بناء ومستلزمات",  code: "PRD-003", salePrice: 800 * M,  purchasePrice: 600 * M,  isInventoried: true,  isActive: true },
    ],
  })

  // ── 5. Bank Account ──────────────────────────────────────────
  await prisma.bankAccount.create({
    data: {
      organizationId,
      accountId: bankId,
      name: "الحساب الجاري الرئيسي",
      accountNumber: "1234567890",
      bankName: country.code === "IQ" ? "مصرف الرشيد" : country.code === "AE" ? "بنك الإمارات دبي الوطني" : "البنك الأهلي السعودي",
      currency,
      currentBalance: 50000 * M,
    },
  })

  // ── 6. Opening Balance via Journal ───────────────────────────
  const equityId = accounts.find((a) => a.code === "3010")?.id
  if (equityId) {
    await prisma.journal.create({
      data: {
        organizationId,
        number: "JNL-0001",
        date: d(-90),
        description: "رصيد افتتاحي",
        status: "POSTED",
        totalDebit: 80000 * M,
        totalCredit: 80000 * M,
        lines: {
          create: [
            { accountId: bankId,    debit: 50000 * M, credit: 0,         description: "رصيد بنكي افتتاحي" },
            { accountId: cashId,    debit: 30000 * M, credit: 0,         description: "رصيد نقدي افتتاحي" },
            { accountId: equityId,  debit: 0,         credit: 80000 * M, description: "رأس المال المدفوع" },
          ],
        },
      },
    })
  }

  // ── 7. Revenue Journal (3 months of monthly revenue) ─────────
  const revenueEntries = [
    { desc: "إيرادات مبيعات — شهر ثلاثة أشهر مضت", amount: 18000 * M, daysAgo: -75 },
    { desc: "إيرادات مبيعات — شهرين مضيا",          amount: 22000 * M, daysAgo: -45 },
    { desc: "إيرادات مبيعات — الشهر الماضي",        amount: 27000 * M, daysAgo: -15 },
    { desc: "إيرادات خدمات — هذا الشهر",            amount: 8000 * M,  daysAgo: -5  },
  ]
  for (let i = 0; i < revenueEntries.length; i++) {
    const e = revenueEntries[i]
    const accId = i < 3 ? revenueId : serviceId
    await prisma.journal.create({
      data: {
        organizationId,
        number: `JNL-${String(i + 2).padStart(4, "0")}`,
        date: d(e.daysAgo),
        description: e.desc,
        status: "POSTED",
        totalDebit: e.amount,
        totalCredit: e.amount,
        lines: {
          create: [
            { accountId: bankId,  debit: e.amount, credit: 0,        description: e.desc },
            { accountId: accId,   debit: 0,        credit: e.amount, description: e.desc },
          ],
        },
      },
    })
  }

  // ── 8. Expense Journals ──────────────────────────────────────
  const expenses = [
    { desc: "رواتب الموظفين — الشهر الماضي",  amount: 8000 * M,  accId: salariesId, daysAgo: -30 },
    { desc: "إيجار المكتب — ربع سنوي",         amount: 6000 * M,  accId: rentId,     daysAgo: -60 },
    { desc: "فاتورة الكهرباء والمياه",           amount: 1200 * M,  accId: utilityId,  daysAgo: -20 },
    { desc: "رواتب الموظفين — هذا الشهر",      amount: 8000 * M,  accId: salariesId, daysAgo: -3  },
    { desc: "مصروفات تشغيلية متنوعة",           amount: 2500 * M,  accId: otherExpId, daysAgo: -10 },
  ]
  for (let i = 0; i < expenses.length; i++) {
    const e = expenses[i]
    if (!e.accId) continue
    await prisma.journal.create({
      data: {
        organizationId,
        number: `JNL-${String(i + 10).padStart(4, "0")}`,
        date: d(e.daysAgo),
        description: e.desc,
        status: "POSTED",
        totalDebit: e.amount,
        totalCredit: e.amount,
        lines: {
          create: [
            { accountId: e.accId, debit: e.amount, credit: 0,        description: e.desc },
            { accountId: bankId,  debit: 0,        credit: e.amount, description: e.desc },
          ],
        },
      },
    })
  }

  // ── 9. Invoices ──────────────────────────────────────────────
  const invoicesData = [
    { contactIdx: 0, status: "PAID",    subtotal: 5000 * M,  daysAgo: -60, dueDays: 30 },
    { contactIdx: 1, status: "PAID",    subtotal: 12000 * M, daysAgo: -45, dueDays: 30 },
    { contactIdx: 2, status: "SENT",    subtotal: 8500 * M,  daysAgo: -20, dueDays: 30 },
    { contactIdx: 0, status: "SENT",    subtotal: 3200 * M,  daysAgo: -10, dueDays: 30 },
    { contactIdx: 3, status: "OVERDUE", subtotal: 15000 * M, daysAgo: -70, dueDays: 30 },
    { contactIdx: 1, status: "PARTIAL", subtotal: 9000 * M,  daysAgo: -35, dueDays: 30 },
    { contactIdx: 2, status: "DRAFT",   subtotal: 4500 * M,  daysAgo: -2,  dueDays: 30 },
  ]

  for (let i = 0; i < invoicesData.length; i++) {
    const inv = invoicesData[i]
    const vatAmt = taxRate ? inv.subtotal * (Number(taxRate.rate) / 100) : 0
    const total = inv.subtotal + vatAmt
    const amountPaid = inv.status === "PAID" ? total : inv.status === "PARTIAL" ? total * 0.5 : 0
    const amountDue = total - amountPaid

    const items = [
      {
        description: "بضاعة متنوعة",
        quantity: 10,
        unitPrice: inv.subtotal * 0.6 / 10,
        taxRateId: taxRate?.id,
        taxAmount: vatAmt * 0.6,
        total: inv.subtotal * 0.6 + vatAmt * 0.6,
      },
      {
        description: "خدمات إضافية",
        quantity: 1,
        unitPrice: inv.subtotal * 0.4,
        taxRateId: taxRate?.id,
        taxAmount: vatAmt * 0.4,
        total: inv.subtotal * 0.4 + vatAmt * 0.4,
      },
    ]

    await prisma.invoice.create({
      data: {
        organizationId,
        contactId: customers[inv.contactIdx].id,
        number: `INV-${String(i + 1).padStart(4, "0")}`,
        date: d(inv.daysAgo),
        dueDate: d(inv.daysAgo + inv.dueDays),
        currency,
        status: inv.status as any,
        subtotal: inv.subtotal,
        taxAmount: vatAmt,
        total,
        amountPaid,
        amountDue,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRateId: item.taxRateId,
            taxAmount: item.taxAmount,
            total: item.total,
          })),
        },
      },
    })
  }

  // ── 10. Bills ────────────────────────────────────────────────
  const billsData = [
    { vendorIdx: 0, status: "PAID",    subtotal: 8000 * M,  daysAgo: -50 },
    { vendorIdx: 1, status: "OPEN",    subtotal: 4500 * M,  daysAgo: -15 },
    { vendorIdx: 2, status: "OVERDUE", subtotal: 12000 * M, daysAgo: -65 },
    { vendorIdx: 0, status: "PARTIAL", subtotal: 6000 * M,  daysAgo: -25 },
    { vendorIdx: 1, status: "OPEN",    subtotal: 3200 * M,  daysAgo: -5  },
  ]

  for (let i = 0; i < billsData.length; i++) {
    const bill = billsData[i]
    const vatAmt = taxRate ? bill.subtotal * (Number(taxRate.rate) / 100) : 0
    const total = bill.subtotal + vatAmt
    const amountPaid = bill.status === "PAID" ? total : bill.status === "PARTIAL" ? total * 0.4 : 0
    const amountDue = total - amountPaid

    await prisma.bill.create({
      data: {
        organizationId,
        contactId: suppliers[bill.vendorIdx].id,
        number: `BILL-${String(i + 1).padStart(4, "0")}`,
        date: d(bill.daysAgo),
        dueDate: d(bill.daysAgo + 30),
        currency,
        status: bill.status as any,
        subtotal: bill.subtotal,
        taxAmount: vatAmt,
        total,
        amountPaid,
        amountDue,
        items: {
          create: [{
            description: "بضاعة مشتراة",
            quantity: 5,
            unitPrice: bill.subtotal / 5,
            taxRateId: taxRate?.id,
            taxAmount: vatAmt,
            total,
          }],
        },
      },
    })
  }

  // ── 11. Employees ─────────────────────────────────────────────
  await prisma.employee.createMany({
    data: [
      { organizationId, name: "أحمد محمد الكاظمي",  employeeId: "EMP-001", position: "مدير مالي",     department: "المالية",    basicSalary: 3000 * M, isActive: true, joinDate: d(-365) },
      { organizationId, name: "سارة علي الجبوري",   employeeId: "EMP-002", position: "محاسبة",        department: "المالية",    basicSalary: 2000 * M, isActive: true, joinDate: d(-280) },
      { organizationId, name: "محمود حسن العبيدي",  employeeId: "EMP-003", position: "مندوب مبيعات",  department: "المبيعات",   basicSalary: 1800 * M, isActive: true, joinDate: d(-200) },
    ],
  })

  const totalCreated =
    customers.length + suppliers.length + invoicesData.length + billsData.length + expenses.length + 3

  return { created: totalCreated }
}

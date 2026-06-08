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
    { name: "معرض النخيل للألعاب",      phone: `${country.phonePrefix}501234567`, type: "CUSTOMER", priceLevel: "WHOLESALE" },
    { name: "محلات الرشيد للإلكترونيات", phone: `${country.phonePrefix}502345678`, type: "CUSTOMER", priceLevel: "WHOLESALE" },
    { name: "علي حسن الموسوي",           phone: `${country.phonePrefix}503456789`, type: "CUSTOMER", priceLevel: "RETAIL" },
    { name: "كلوب ستيشن بغداد",          phone: `${country.phonePrefix}504567890`, type: "CUSTOMER", priceLevel: "VIP" },
  ]
  const suppliersData = [
    { name: "شركة الخليج للاستيراد والتوزيع",  phone: `${country.phonePrefix}505678901`, type: "VENDOR" },
    { name: "مستودع العراق للإلكترونيات",       phone: `${country.phonePrefix}506789012`, type: "VENDOR" },
    { name: "شركة سوني العالمية للتوزيع",       phone: `${country.phonePrefix}507890123`, type: "VENDOR" },
  ]

  const customers = await Promise.all(
    customersData.map((c) =>
      prisma.contact.create({ data: { organizationId, name: c.name, phone: c.phone, type: "CUSTOMER", priceLevel: c.priceLevel, isActive: true } })
    )
  )
  const suppliers = await Promise.all(
    suppliersData.map((s) =>
      prisma.contact.create({ data: { organizationId, name: s.name, phone: s.phone, type: "VENDOR", isActive: true } })
    )
  )

  // ── 4. Products (PlayStation & gaming) ──────────────────────
  const [ps5, ps4pro, dualsense, psn50, psn100, game1, game2, headset] = await Promise.all([
    prisma.product.create({ data: { organizationId, name: "PlayStation 5 (PS5) Disc Edition", code: "PS5-001",   unit: "جهاز", salePrice: 900 * M,  wholesalePrice: 800 * M, vipPrice: 750 * M,  purchasePrice: 650 * M,  isInventoried: true,  tracksSerial: true,  isActive: true, reorderLevel: 2 } }),
    prisma.product.create({ data: { organizationId, name: "PlayStation 4 Pro 1TB",              code: "PS4P-001", unit: "جهاز", salePrice: 450 * M,  wholesalePrice: 400 * M, vipPrice: 380 * M,  purchasePrice: 300 * M,  isInventoried: true,  tracksSerial: true,  isActive: true, reorderLevel: 3 } }),
    prisma.product.create({ data: { organizationId, name: "DualSense Controller",                code: "ACC-001",  unit: "قطعة", salePrice: 100 * M,  wholesalePrice: 90 * M,  vipPrice: 85 * M,   purchasePrice: 65 * M,   isInventoried: true,  tracksSerial: false, isActive: true, reorderLevel: 5 } }),
    prisma.product.create({ data: { organizationId, name: "PSN Gift Card $50",                   code: "PSN-050",  unit: "بطاقة", salePrice: 85 * M,   wholesalePrice: 80 * M,  vipPrice: 78 * M,   purchasePrice: 70 * M,   isInventoried: true,  tracksSerial: false, isActive: true, reorderLevel: 10 } }),
    prisma.product.create({ data: { organizationId, name: "PSN Gift Card $100",                  code: "PSN-100",  unit: "بطاقة", salePrice: 165 * M,  wholesalePrice: 155 * M, vipPrice: 150 * M,  purchasePrice: 138 * M,  isInventoried: true,  tracksSerial: false, isActive: true, reorderLevel: 10 } }),
    prisma.product.create({ data: { organizationId, name: "FIFA 25 PS5",                          code: "GAME-001", unit: "لعبة",  salePrice: 65 * M,   wholesalePrice: 60 * M,  vipPrice: 55 * M,   purchasePrice: 45 * M,   isInventoried: true,  tracksSerial: false, isActive: true, reorderLevel: 5 } }),
    prisma.product.create({ data: { organizationId, name: "GTA VI PS5",                           code: "GAME-002", unit: "لعبة",  salePrice: 75 * M,   wholesalePrice: 70 * M,  vipPrice: 65 * M,   purchasePrice: 55 * M,   isInventoried: true,  tracksSerial: false, isActive: true, reorderLevel: 5 } }),
    prisma.product.create({ data: { organizationId, name: "PULSE 3D Headset",                     code: "ACC-002",  unit: "قطعة", salePrice: 130 * M,  wholesalePrice: 120 * M, vipPrice: 115 * M,  purchasePrice: 90 * M,   isInventoried: true,  tracksSerial: false, isActive: true, reorderLevel: 3 } }),
  ])

  // Seed serial numbers for PS5 units
  const warehouse = await prisma.warehouse.findFirst({ where: { organizationId } })
  if (warehouse) {
    const ps5Serials = ["CF1234567890", "CF2345678901", "CF3456789012", "CF4567890123", "CF5678901234"]
    for (const sn of ps5Serials) {
      await prisma.productSerial.create({
        data: { organizationId, productId: ps5.id, serialNumber: sn, condition: "NEW", warrantyMonths: 12, status: "IN_STOCK" },
      })
      await prisma.stockLedger.create({
        data: { productId: ps5.id, warehouseId: warehouse.id, date: d(-30), reference: "DEMO-OPEN", quantity: 1, unitCost: 650 * M, type: "IN" },
      })
    }
    // PS4 Pro serials
    const ps4Serials = ["CUH7215A001", "CUH7215A002", "CUH7215A003"]
    for (const sn of ps4Serials) {
      await prisma.productSerial.create({
        data: { organizationId, productId: ps4pro.id, serialNumber: sn, condition: "NEW", warrantyMonths: 12, status: "IN_STOCK" },
      })
      await prisma.stockLedger.create({
        data: { productId: ps4pro.id, warehouseId: warehouse.id, date: d(-30), reference: "DEMO-OPEN", quantity: 1, unitCost: 300 * M, type: "IN" },
      })
    }
    // Accessories stock
    for (const [prod, qty, cost] of [[dualsense, 15, 65], [psn50, 30, 70], [psn100, 20, 138], [game1, 12, 45], [game2, 8, 55], [headset, 6, 90]] as [typeof dualsense, number, number][]) {
      await prisma.stockLedger.create({
        data: { productId: prod.id, warehouseId: warehouse.id, date: d(-30), reference: "DEMO-OPEN", quantity: qty, unitCost: cost * M, type: "IN" },
      })
    }
  }

  // ── 5. Bank Account ──────────────────────────────────────────
  await prisma.bankAccount.create({
    data: {
      organizationId,
      accountId: bankId,
      name: country.code === "IQ" ? "مصرف الرشيد — الحساب الجاري" : country.code === "AE" ? "بنك الإمارات دبي الوطني" : "البنك الأهلي السعودي",
      accountNumber: country.code === "IQ" ? "IQ29RASH050020012345678" : "1234567890",
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
  const invoicesDef = [
    { contactIdx: 0, status: "PAID",    daysAgo: -60, dueDays: 30, productId: ps5.id,      qty: 2,  unit: 900 * M, desc: "PlayStation 5 Disc Edition" },
    { contactIdx: 1, status: "PAID",    daysAgo: -45, dueDays: 30, productId: ps5.id,      qty: 1,  unit: 900 * M, desc: "PlayStation 5 Disc Edition" },
    { contactIdx: 2, status: "SENT",    daysAgo: -20, dueDays: 30, productId: dualsense.id, qty: 10, unit: 100 * M, desc: "DualSense Controller" },
    { contactIdx: 0, status: "SENT",    daysAgo: -10, dueDays: 30, productId: psn50.id,     qty: 15, unit: 85 * M,  desc: "PSN Gift Card $50" },
    { contactIdx: 3, status: "OVERDUE", daysAgo: -70, dueDays: 30, productId: ps4pro.id,    qty: 3,  unit: 450 * M, desc: "PlayStation 4 Pro 1TB" },
    { contactIdx: 1, status: "PARTIAL", daysAgo: -35, dueDays: 30, productId: game1.id,     qty: 20, unit: 65 * M,  desc: "FIFA 25 PS5" },
    { contactIdx: 2, status: "DRAFT",   daysAgo: -2,  dueDays: 30, productId: ps5.id,       qty: 1,  unit: 950 * M, desc: "PlayStation 5 Bundle" },
  ]

  for (let i = 0; i < invoicesDef.length; i++) {
    const inv   = invoicesDef[i]
    const sub   = Math.round(inv.qty * inv.unit * 100) / 100
    const vatAmt = taxRate ? Math.round(sub * (Number(taxRate.rate) / 100) * 100) / 100 : 0
    const total = sub + vatAmt
    const amountPaid = inv.status === "PAID" ? total : inv.status === "PARTIAL" ? Math.round(total * 0.5 * 100) / 100 : 0
    const amountDue = Math.round((total - amountPaid) * 100) / 100

    const items = [
      {
        description: inv.desc,
        productId:   inv.productId,
        quantity:    inv.qty,
        unitPrice:   inv.unit,
        taxRateId:   taxRate?.id,
        taxAmount:   vatAmt,
        total:       sub,
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
        subtotal: sub,
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
    { vendorIdx: 0, status: "PAID",    daysAgo: -50, productId: ps5.id,      qty: 5,  unitCost: 650 * M, desc: "PlayStation 5 Disc Edition" },
    { vendorIdx: 1, status: "OPEN",    daysAgo: -15, productId: dualsense.id, qty: 20, unitCost: 65 * M,  desc: "DualSense Controller" },
    { vendorIdx: 2, status: "OVERDUE", daysAgo: -65, productId: ps4pro.id,    qty: 10, unitCost: 300 * M, desc: "PlayStation 4 Pro 1TB" },
    { vendorIdx: 0, status: "PARTIAL", daysAgo: -25, productId: psn50.id,     qty: 50, unitCost: 70 * M,  desc: "PSN Gift Card $50" },
    { vendorIdx: 1, status: "OPEN",    daysAgo: -5,  productId: game1.id,     qty: 30, unitCost: 45 * M,  desc: "FIFA 25 PS5" },
  ]

  for (let i = 0; i < billsData.length; i++) {
    const bill = billsData[i]
    const sub  = Math.round(bill.qty * bill.unitCost * 100) / 100
    const vatAmt = taxRate ? Math.round(sub * (Number(taxRate.rate) / 100) * 100) / 100 : 0
    const total = sub + vatAmt
    const amountPaid = bill.status === "PAID" ? total : bill.status === "PARTIAL" ? Math.round(total * 0.4 * 100) / 100 : 0
    const amountDue = Math.round((total - amountPaid) * 100) / 100

    await prisma.bill.create({
      data: {
        organizationId,
        contactId: suppliers[bill.vendorIdx].id,
        number: `BILL-${String(i + 1).padStart(4, "0")}`,
        date: d(bill.daysAgo),
        dueDate: d(bill.daysAgo + 30),
        currency,
        status: bill.status as any,
        subtotal: sub,
        taxAmount: vatAmt,
        total,
        amountPaid,
        amountDue,
        items: {
          create: [{
            description: bill.desc,
            productId:   bill.productId,
            quantity:    bill.qty,
            unitPrice:   bill.unitCost,
            taxRateId:   taxRate?.id,
            taxAmount:   vatAmt,
            total:       sub,
          }],
        },
      },
    })
  }

  // ── 11. Employees (with commission rates for sales reps) ──────
  await prisma.employee.createMany({
    data: [
      { organizationId, name: "أحمد محمد الكاظمي",  employeeId: "EMP-001", position: "مدير متجر",     department: "الإدارة",    basicSalary: 1500 * M, isActive: true, joinDate: d(-365), commissionRate: null },
      { organizationId, name: "سارة علي الجبوري",   employeeId: "EMP-002", position: "محاسبة",        department: "المالية",    basicSalary: 900 * M,  isActive: true, joinDate: d(-280), commissionRate: null },
      { organizationId, name: "محمود حسن العبيدي",  employeeId: "EMP-003", position: "مندوب مبيعات",  department: "المبيعات",   basicSalary: 600 * M,  isActive: true, joinDate: d(-200), commissionRate: 2.5 },
      { organizationId, name: "حسين علاء الدين",    employeeId: "EMP-004", position: "مندوب مبيعات",  department: "المبيعات",   basicSalary: 600 * M,  isActive: true, joinDate: d(-150), commissionRate: 2.5 },
    ],
  })

  const totalCreated =
    customers.length + suppliers.length + invoicesDef.length + billsData.length + expenses.length + 4

  return { created: totalCreated }
}

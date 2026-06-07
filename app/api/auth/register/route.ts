import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { generateSlug } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import { rateLimit, getClientId } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  // 5 register attempts per IP per hour
  const rl = rateLimit(`register:${getClientId(req)}`, { limit: 5, windowSec: 3600 })
  if (!rl.success) {
    return NextResponse.json(
      { error: "لقد تجاوزت الحد المسموح به. حاول مجدداً بعد ساعة." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  try {
    const { name, email, password, orgName, country = "SA" } = await req.json()

    if (!name || !email || !password || !orgName) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 400 })
    }

    const countryConfig = getCountry(country)
    const hashed = await bcrypt.hash(password, 12)
    let slug = generateSlug(orgName)
    const slugExists = await prisma.organization.findUnique({ where: { slug } })
    if (slugExists) slug = `${slug}-${Date.now()}`

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        organizations: {
          create: {
            role: "OWNER",
            isDefault: true,
            organization: {
              create: {
                name: orgName,
                slug,
                country:         countryConfig.code,
                baseCurrency:    countryConfig.currency,
                fiscalYearStart: countryConfig.fiscalYearStart,
                plan:            "PROFESSIONAL",
                trialEndsAt:     new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      },
      include: {
        organizations: { include: { organization: true } },
      },
    })

    const org = user.organizations[0].organization
    await seedDefaultAccounts(org.id, countryConfig)

    return NextResponse.json({ success: true, userId: user.id })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ error: "حدث خطأ في إنشاء الحساب" }, { status: 500 })
  }
}

async function seedDefaultAccounts(organizationId: string, country: ReturnType<typeof getCountry>) {
  const groups = [
    { name: "الأصول", code: "1", nature: "DEBIT" as const },
    { name: "الأصول المتداولة", code: "11", nature: "DEBIT" as const, parentName: "الأصول" },
    { name: "الأصول الثابتة", code: "12", nature: "DEBIT" as const, parentName: "الأصول" },
    { name: "الخصوم", code: "2", nature: "CREDIT" as const },
    { name: "الخصوم المتداولة", code: "21", nature: "CREDIT" as const, parentName: "الخصوم" },
    { name: "الخصوم طويلة الأجل", code: "22", nature: "CREDIT" as const, parentName: "الخصوم" },
    { name: "حقوق الملكية", code: "3", nature: "CREDIT" as const },
    { name: "الإيرادات", code: "4", nature: "CREDIT" as const },
    { name: "المصروفات", code: "5", nature: "DEBIT" as const },
    { name: "مصروفات تشغيلية", code: "51", nature: "DEBIT" as const, parentName: "المصروفات" },
    { name: "مصروفات إدارية", code: "52", nature: "DEBIT" as const, parentName: "المصروفات" },
  ]

  const createdGroups: Record<string, string> = {}

  for (const g of groups) {
    const parentId = g.parentName ? createdGroups[g.parentName] : undefined
    const group = await prisma.accountGroup.create({
      data: { organizationId, name: g.name, code: g.code, nature: g.nature, parentId, isSystem: true },
    })
    createdGroups[g.name] = group.id
  }

  // Tax account name varies by country
  const taxAccountName = country.vatEnabled
    ? country.vatName
    : "ضريبة الدخل المستحقة"

  const accounts = [
    { code: "1010", name: "الصندوق", type: "CASH", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1020", name: "البنك - الحساب الرئيسي", type: "BANK", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1110", name: "العملاء", type: "ACCOUNTS_RECEIVABLE", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1120", name: "المخزون", type: "STOCK", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1130", name: "المصروفات المدفوعة مقدماً", type: "ASSET", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1210", name: "الأصول الثابتة", type: "FIXED_ASSET", nature: "DEBIT", groupName: "الأصول الثابتة" },
    { code: "1211", name: "مجمع الإهلاك", type: "FIXED_ASSET", nature: "CREDIT", groupName: "الأصول الثابتة" },
    { code: "2110", name: "الموردون", type: "ACCOUNTS_PAYABLE", nature: "CREDIT", groupName: "الخصوم المتداولة" },
    { code: "2120", name: taxAccountName, type: "TAX", nature: "CREDIT", groupName: "الخصوم المتداولة" },
    { code: "2130", name: "الرواتب المستحقة", type: "LIABILITY", nature: "CREDIT", groupName: "الخصوم المتداولة" },
    { code: "2210", name: "القروض طويلة الأجل", type: "LIABILITY", nature: "CREDIT", groupName: "الخصوم طويلة الأجل" },
    { code: "3010", name: "رأس المال", type: "EQUITY", nature: "CREDIT", groupName: "حقوق الملكية" },
    { code: "3020", name: "الأرباح المبقاة", type: "EQUITY", nature: "CREDIT", groupName: "حقوق الملكية" },
    { code: "4010", name: "المبيعات", type: "REVENUE", nature: "CREDIT", groupName: "الإيرادات" },
    { code: "4020", name: "إيرادات خدمات", type: "REVENUE", nature: "CREDIT", groupName: "الإيرادات" },
    { code: "4030", name: "إيرادات أخرى", type: "REVENUE", nature: "CREDIT", groupName: "الإيرادات" },
    { code: "5010", name: "تكلفة البضاعة المباعة", type: "EXPENSE", nature: "DEBIT", groupName: "مصروفات تشغيلية" },
    { code: "5110", name: "الرواتب والأجور", type: "EXPENSE", nature: "DEBIT", groupName: "مصروفات إدارية" },
    { code: "5120", name: "الإيجار", type: "EXPENSE", nature: "DEBIT", groupName: "مصروفات إدارية" },
    { code: "5130", name: "الكهرباء والمياه", type: "EXPENSE", nature: "DEBIT", groupName: "مصروفات إدارية" },
    { code: "5140", name: "الاتصالات", type: "EXPENSE", nature: "DEBIT", groupName: "مصروفات إدارية" },
    { code: "5150", name: "التسويق والإعلان", type: "EXPENSE", nature: "DEBIT", groupName: "مصروفات إدارية" },
    { code: "5160", name: "الإهلاك", type: "EXPENSE", nature: "DEBIT", groupName: "مصروفات إدارية" },
    { code: "5170", name: "مصروفات أخرى", type: "EXPENSE", nature: "DEBIT", groupName: "مصروفات إدارية" },
  ]

  for (const a of accounts) {
    const groupId = createdGroups[a.groupName]
    if (!groupId) continue
    await prisma.account.create({
      data: {
        organizationId,
        code: a.code,
        name: a.name,
        accountType: a.type as any,
        nature: a.nature as any,
        groupId,
        isSystem: true,
      },
    })
  }

  // Only create VAT tax rate if country has VAT
  if (country.vatEnabled && country.vatRate > 0) {
    await prisma.taxRate.create({
      data: {
        organizationId,
        name: country.vatName,
        code: `VAT${country.vatRate}`,
        rate: country.vatRate,
        taxType: "VAT",
      },
    })
  }

  // Create base currency
  await prisma.organizationCurrency.create({
    data: {
      organizationId,
      code: country.currency,
      name: country.currencyAr,
      symbol: country.currencySymbol,
      exchangeRate: 1,
      isBase: true,
    },
  })

  // Create fiscal year
  const now = new Date()
  const startMonth = (country.fiscalYearStart ?? 1) - 1
  const startYear = startMonth > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear()
  await prisma.fiscalYear.create({
    data: {
      organizationId,
      name: `السنة المالية ${startYear}`,
      startDate: new Date(startYear, startMonth, 1),
      endDate: new Date(startYear + 1, startMonth, 0),
    },
  })
}

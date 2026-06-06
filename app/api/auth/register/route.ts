import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { generateSlug } from "@/lib/utils"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, orgName } = await req.json()

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
                fiscalYearStart: 1,
                baseCurrency: "SAR",
              },
            },
          },
        },
      },
      include: {
        organizations: { include: { organization: true } },
      },
    })

    // Seed default chart of accounts
    const org = user.organizations[0].organization
    await seedDefaultAccounts(org.id)

    return NextResponse.json({ success: true, userId: user.id })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ error: "حدث خطأ في إنشاء الحساب" }, { status: 500 })
  }
}

async function seedDefaultAccounts(organizationId: string) {
  // Create default account groups (Tally-style hierarchy)
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
      data: {
        organizationId,
        name: g.name,
        code: g.code,
        nature: g.nature,
        parentId,
        isSystem: true,
      },
    })
    createdGroups[g.name] = group.id
  }

  // Create default accounts
  const accounts = [
    { code: "1010", name: "الصندوق", type: "CASH", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1020", name: "البنك - الحساب الرئيسي", type: "BANK", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1110", name: "العملاء", type: "ACCOUNTS_RECEIVABLE", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1120", name: "المخزون", type: "STOCK", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1130", name: "المصروفات المدفوعة مقدماً", type: "ASSET", nature: "DEBIT", groupName: "الأصول المتداولة" },
    { code: "1210", name: "الأصول الثابتة", type: "FIXED_ASSET", nature: "DEBIT", groupName: "الأصول الثابتة" },
    { code: "1211", name: "مجمع الإهلاك", type: "FIXED_ASSET", nature: "CREDIT", groupName: "الأصول الثابتة" },
    { code: "2110", name: "الموردون", type: "ACCOUNTS_PAYABLE", nature: "CREDIT", groupName: "الخصوم المتداولة" },
    { code: "2120", name: "ضريبة القيمة المضافة المستحقة", type: "TAX", nature: "CREDIT", groupName: "الخصوم المتداولة" },
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

  // Create default tax rate (VAT 15% - Saudi Arabia)
  await prisma.taxRate.create({
    data: {
      organizationId,
      name: "ضريبة القيمة المضافة 15%",
      code: "VAT15",
      rate: 15,
      taxType: "VAT",
    },
  })

  // Create fiscal year
  const now = new Date()
  await prisma.fiscalYear.create({
    data: {
      organizationId,
      name: `السنة المالية ${now.getFullYear()}`,
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: new Date(now.getFullYear(), 11, 31),
    },
  })
}

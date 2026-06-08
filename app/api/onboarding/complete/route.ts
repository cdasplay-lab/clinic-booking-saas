import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const INDUSTRY_EXTRAS: Record<string, { code: string; name: string; type: string; nature: string; groupCode: string }[]> = {
  gaming: [
    { code: "4037", name: "مبيعات أجهزة وألعاب",         type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "4038", name: "مبيعات بطاقات PSN وديجيتال",  type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "4039", name: "خدمات الضمان والصيانة",        type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "1129", name: "مخزون الأجهزة والإكسسوارات",  type: "STOCK",   nature: "DEBIT",  groupCode: "الأصول المتداولة" },
    { code: "5016", name: "تكلفة بضاعة مباعة - أجهزة",   type: "EXPENSE", nature: "DEBIT",  groupCode: "مصروفات تشغيلية" },
    { code: "5185", name: "مصروفات الضمان والإصلاح",      type: "EXPENSE", nature: "DEBIT",  groupCode: "مصروفات إدارية" },
    { code: "5186", name: "عمولات المندوبين",              type: "EXPENSE", nature: "DEBIT",  groupCode: "مصروفات إدارية" },
  ],
  services: [
    { code: "4025", name: "إيرادات استشارات", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "4026", name: "إيرادات تدريب", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "5180", name: "مصروفات السفر والتنقل", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات إدارية" },
    { code: "5181", name: "نثريات ومصروفات متنوعة", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات إدارية" },
  ],
  construction: [
    { code: "4027", name: "إيرادات المقاولات", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "1125", name: "مواد البناء", type: "STOCK", nature: "DEBIT", groupCode: "الأصول المتداولة" },
    { code: "5011", name: "تكلفة مواد البناء", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات تشغيلية" },
    { code: "5012", name: "أجور عمال", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات تشغيلية" },
    { code: "5013", name: "إيجار معدات", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات تشغيلية" },
  ],
  clinic: [
    { code: "4028", name: "إيرادات الكشوفات الطبية", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "4029", name: "إيرادات الإجراءات الطبية", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "4030", name: "إيرادات الصيدلية", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "1126", name: "مخزون الأدوية واللوازم الطبية", type: "STOCK", nature: "DEBIT", groupCode: "الأصول المتداولة" },
    { code: "5182", name: "مصروفات الأجهزة الطبية", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات إدارية" },
    { code: "5183", name: "مستلزمات طبية", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات إدارية" },
  ],
  restaurant: [
    { code: "4031", name: "إيرادات المبيعات - طعام", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "4032", name: "إيرادات المبيعات - مشروبات", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "4033", name: "خدمة التوصيل", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "1127", name: "مخزون المواد الغذائية", type: "STOCK", nature: "DEBIT", groupCode: "الأصول المتداولة" },
    { code: "5014", name: "تكلفة المواد الغذائية", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات تشغيلية" },
    { code: "5184", name: "مصروفات مطبخ وتجهيز", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات إدارية" },
  ],
  retail: [
    { code: "4034", name: "مبيعات جملة", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "4035", name: "مبيعات تجزئة", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "4036", name: "عمولات بيع", type: "REVENUE", nature: "CREDIT", groupCode: "الإيرادات" },
    { code: "1128", name: "بضاعة في الطريق", type: "STOCK", nature: "DEBIT", groupCode: "الأصول المتداولة" },
    { code: "5015", name: "مصروفات التغليف والشحن", type: "EXPENSE", nature: "DEBIT", groupCode: "مصروفات تشغيلية" },
  ],
  general: [],
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = userOrg.organizationId
  const { address, phone, taxNumber, industry } = await req.json()

  // Update org profile
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(address    !== undefined && { address:   address?.trim()   || null }),
      ...(phone      !== undefined && { phone:     phone?.trim()     || null }),
      ...(taxNumber  !== undefined && { taxNumber: taxNumber?.trim() || null }),
    },
  })

  // Add industry-specific accounts (skip if already exist)
  const extras = INDUSTRY_EXTRAS[industry] ?? []
  if (extras.length > 0) {
    const existingCodes = await prisma.account.findMany({
      where: { organizationId: orgId, code: { in: extras.map((e) => e.code) } },
      select: { code: true },
    })
    const existingSet = new Set(existingCodes.map((a) => a.code))

    const groups = await prisma.accountGroup.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    })
    const groupMap = Object.fromEntries(groups.map((g) => [g.name, g.id]))

    for (const extra of extras) {
      if (existingSet.has(extra.code)) continue
      const groupId = groupMap[extra.groupCode]
      if (!groupId) continue
      await prisma.account.create({
        data: {
          organizationId: orgId,
          code:        extra.code,
          name:        extra.name,
          accountType: extra.type as any,
          nature:      extra.nature as any,
          groupId,
          isSystem:    false,
        },
      })
    }
  }

  return NextResponse.json({ success: true })
}

import { auth } from "./auth"
import { prisma } from "./prisma"
import { redirect } from "next/navigation"

export async function getCurrentOrg() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })

  if (!userOrg) {
    const firstOrg = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
    })
    if (!firstOrg) redirect("/onboarding")
    return firstOrg
  }

  return userOrg
}

export async function getNextDocNumber(organizationId: string, docType: string) {
  const seq = await prisma.documentSequence.upsert({
    where: { organizationId_docType: { organizationId, docType } },
    create: {
      organizationId,
      docType,
      prefix: getPrefix(docType),
      currentNumber: 1,
    },
    update: { currentNumber: { increment: 1 } },
  })

  const padded = String(seq.currentNumber).padStart(seq.padding, "0")
  return `${seq.prefix}-${padded}`
}

export async function getOrCreateDefaultWarehouse(organizationId: string) {
  let warehouse = await prisma.warehouse.findFirst({
    where: { organizationId, isDefault: true },
  })
  if (!warehouse) {
    warehouse = await prisma.warehouse.findFirst({ where: { organizationId } })
  }
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: { organizationId, name: "المستودع الرئيسي", code: "WH-01", isDefault: true },
    })
  }
  return warehouse
}

function getPrefix(docType: string) {
  const map: Record<string, string> = {
    INVOICE: "INV",
    BILL: "BILL",
    PAYMENT: "PAY",
    JOURNAL: "JNL",
    PO: "PO",
    SO: "SO",
    PAYROLL: "PAY",
  }
  return map[docType] || docType.slice(0, 3)
}

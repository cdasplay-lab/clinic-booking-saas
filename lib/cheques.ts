import { prisma } from "./prisma"

/**
 * Cheque accounting helpers.
 *
 * Post-dated cheques (شيكات آجلة) are central to Gulf/UAE B2B trade.
 * A received cheque is NOT cash until it clears — it sits in a holding account.
 *
 * Incoming cheque (from customer):
 *   1. Recorded  → DR "شيكات برسم التحصيل" (asset)      / CR Accounts Receivable
 *   2. Cleared   → DR Bank                              / CR "شيكات برسم التحصيل"
 *   3. Bounced   → DR Accounts Receivable               / CR "شيكات برسم التحصيل" (reverse)
 *
 * Outgoing cheque (to supplier):
 *   1. Recorded  → DR Accounts Payable                  / CR "شيكات دفع آجلة" (liability)
 *   2. Cleared   → DR "شيكات دفع آجلة"                  / CR Bank
 *   3. Bounced   → DR "شيكات دفع آجلة"                  / CR Accounts Payable (reverse)
 */

const CHEQUE_RECEIVABLE_CODE = "1140" // شيكات برسم التحصيل (أصل)
const CHEQUE_PAYABLE_CODE    = "2140" // شيكات دفع آجلة (التزام)

/** Find or create the cheque holding account for a given direction. */
export async function getChequeAccount(
  organizationId: string,
  type: "INCOMING" | "OUTGOING"
) {
  const isIncoming = type === "INCOMING"
  const code = isIncoming ? CHEQUE_RECEIVABLE_CODE : CHEQUE_PAYABLE_CODE
  const name = isIncoming ? "شيكات برسم التحصيل" : "شيكات دفع آجلة"

  let account = await prisma.account.findFirst({
    where: { organizationId, code },
  })
  if (account) return account

  // Need a group to attach it to. Pick a current-asset / current-liability group.
  const groupName = isIncoming ? "الأصول المتداولة" : "الخصوم المتداولة"
  let group = await prisma.accountGroup.findFirst({
    where: { organizationId, name: groupName },
  })
  // Fallback: any group of the right nature
  if (!group) {
    group = await prisma.accountGroup.findFirst({
      where: { organizationId, nature: isIncoming ? "DEBIT" : "CREDIT" },
    })
  }
  if (!group) {
    // Last resort: create a minimal group
    group = await prisma.accountGroup.create({
      data: {
        organizationId,
        name: groupName,
        code: isIncoming ? "11" : "21",
        nature: isIncoming ? "DEBIT" : "CREDIT",
      },
    })
  }

  account = await prisma.account.create({
    data: {
      organizationId,
      groupId: group.id,
      code,
      name,
      nature: isIncoming ? "DEBIT" : "CREDIT",
      accountType: isIncoming ? "ASSET" : "LIABILITY",
      isSystem: true,
    },
  })
  return account
}

/** Resolve the AR/AP control account for an organization. */
export async function getControlAccount(
  organizationId: string,
  type: "AR" | "AP"
) {
  return prisma.account.findFirst({
    where: {
      organizationId,
      accountType: type === "AR" ? "ACCOUNTS_RECEIVABLE" : "ACCOUNTS_PAYABLE",
    },
  })
}

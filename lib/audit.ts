import { prisma } from "@/lib/prisma"

export interface AuditParams {
  organizationId: string
  userId: string
  userName: string
  action: "CREATE" | "UPDATE" | "DELETE" | "SEND" | "POST" | "CANCEL" | "PAY" | "LOGIN" | "IMPORT" | "EXPORT"
  entityType: "INVOICE" | "BILL" | "JOURNAL" | "CONTACT" | "PRODUCT" | "PAYMENT" | "SETTINGS" | "USER" | "ATTACHMENT"
  entityId: string
  entityLabel?: string
  changes?: Record<string, [unknown, unknown]>
  ipAddress?: string
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityLabel: params.entityLabel,
        changes: params.changes as any,
        ipAddress: params.ipAddress,
      },
    })
  } catch {
    // Audit failures must never crash the main operation
  }
}

export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {}
  for (const field of fields) {
    const b = before[field]
    const a = after[field]
    if (String(b) !== String(a)) {
      changes[field] = [b, a]
    }
  }
  return changes
}

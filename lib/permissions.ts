// Role hierarchy: OWNER > ADMIN > ACCOUNTANT > MANAGER > VIEWER

export type OrgRole = "OWNER" | "ADMIN" | "ACCOUNTANT" | "MANAGER" | "VIEWER"

const ROLE_LEVEL: Record<OrgRole, number> = {
  OWNER: 5,
  ADMIN: 4,
  ACCOUNTANT: 3,
  MANAGER: 2,
  VIEWER: 1,
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  OWNER:      "مالك",
  ADMIN:      "مدير النظام",
  ACCOUNTANT: "محاسب",
  MANAGER:    "مدير",
  VIEWER:     "مشاهد فقط",
}

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  OWNER:      "صلاحيات كاملة — لا يمكن إزالته",
  ADMIN:      "كل الصلاحيات عدا نقل الملكية",
  ACCOUNTANT: "إدخال وتعديل القيود والفواتير والتقارير",
  MANAGER:    "إدارة العملاء والمنتجات والمخزون — قراءة الحسابات",
  VIEWER:     "قراءة فقط — لا يمكنه التعديل",
}

export const ROLE_COLORS: Record<OrgRole, string> = {
  OWNER:      "bg-purple-100 text-purple-700",
  ADMIN:      "bg-blue-100 text-blue-700",
  ACCOUNTANT: "bg-green-100 text-green-700",
  MANAGER:    "bg-orange-100 text-orange-700",
  VIEWER:     "bg-gray-100 text-gray-600",
}

// Check if a role can perform an action on a target role
export function canManage(actor: OrgRole, target: OrgRole): boolean {
  if (actor === "OWNER") return target !== "OWNER"
  if (actor === "ADMIN") return ROLE_LEVEL[target] < ROLE_LEVEL["ADMIN"]
  return false
}

export function canChangeRole(actor: OrgRole, targetNewRole: OrgRole): boolean {
  if (actor === "OWNER") return targetNewRole !== "OWNER"
  if (actor === "ADMIN") return ROLE_LEVEL[targetNewRole] < ROLE_LEVEL["ADMIN"]
  return false
}

// Permission checks used throughout the app
export const can = {
  manageSettings:  (role: OrgRole) => ["OWNER", "ADMIN"].includes(role),
  manageUsers:     (role: OrgRole) => ["OWNER", "ADMIN"].includes(role),
  writeAccounting: (role: OrgRole) => ["OWNER", "ADMIN", "ACCOUNTANT"].includes(role),
  writeContacts:   (role: OrgRole) => ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"].includes(role),
  writeProducts:   (role: OrgRole) => ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"].includes(role),
  readReports:     (role: OrgRole) => role !== "VIEWER" || true, // all can read
  writePayroll:    (role: OrgRole) => ["OWNER", "ADMIN", "ACCOUNTANT"].includes(role),
  deleteRecords:   (role: OrgRole) => ["OWNER", "ADMIN"].includes(role),
}

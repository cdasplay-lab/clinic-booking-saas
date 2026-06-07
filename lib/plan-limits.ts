export const PLAN_LIMITS = {
  FREE:         { invoicesPerMonth: 100, users: 1,  orgs: 1,  aiAgent: false, api: false },
  STARTER:      { invoicesPerMonth: -1,  users: 5,  orgs: 3,  aiAgent: false, api: false },
  PROFESSIONAL: { invoicesPerMonth: -1,  users: 20, orgs: 10, aiAgent: true,  api: true  },
  ENTERPRISE:   { invoicesPerMonth: -1,  users: -1, orgs: -1, aiAgent: true,  api: true  },
}

export type PlanId = keyof typeof PLAN_LIMITS

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.FREE
}

export function canUpgrade(current: string, target: string): boolean {
  const order: PlanId[] = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]
  return order.indexOf(target as PlanId) > order.indexOf(current as PlanId)
}

import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
})

export const PLAN_PRICE_IDS: Record<string, string> = {
  STARTER:      process.env.STRIPE_PRICE_STARTER      || "",
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL || "",
  ENTERPRISE:   process.env.STRIPE_PRICE_ENTERPRISE   || "",
}

export function planFromPriceId(priceId: string): string {
  return Object.entries(PLAN_PRICE_IDS).find(([, pid]) => pid === priceId)?.[0] || "FREE"
}

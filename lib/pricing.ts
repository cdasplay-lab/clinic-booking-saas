/**
 * Multi-tier pricing — جملة / مفرد / سعر خاص
 *
 * Every product carries three prices. Each customer is assigned a price level
 * so the right price is applied automatically at the point of sale.
 */

export type PriceLevel = "RETAIL" | "WHOLESALE" | "VIP"

export const PRICE_LEVELS: { value: PriceLevel; label: string }[] = [
  { value: "RETAIL",    label: "مفرد" },
  { value: "WHOLESALE", label: "جملة" },
  { value: "VIP",       label: "سعر خاص (VIP)" },
]

export function priceLevelLabel(level?: string | null): string {
  return PRICE_LEVELS.find((l) => l.value === level)?.label ?? "مفرد"
}

type PricedProduct = {
  salePrice:      number | { toString(): string }
  wholesalePrice: number | { toString(): string }
  vipPrice:       number | { toString(): string }
}

/**
 * Resolve the unit price for a product given a customer's price level.
 * Falls back to retail (salePrice) when the chosen tier is unset (0).
 */
export function priceForLevel(product: PricedProduct, level?: string | null): number {
  const retail    = Number(product.salePrice)      || 0
  const wholesale = Number(product.wholesalePrice) || 0
  const vip       = Number(product.vipPrice)       || 0

  switch (level) {
    case "WHOLESALE": return wholesale > 0 ? wholesale : retail
    case "VIP":       return vip       > 0 ? vip       : retail
    default:          return retail
  }
}

const TAP_API = "https://api.tap.company/v2"

export function tapHeaders() {
  return {
    "Authorization": `Bearer ${process.env.TAP_SECRET_KEY}`,
    "Content-Type": "application/json",
  }
}

export interface TapChargeParams {
  amount: number
  currency: string
  customerName: string
  customerEmail?: string | null
  customerPhone?: string | null
  description: string
  orderId: string       // our invoice id
  redirectUrl: string
  webhookUrl?: string
}

export interface TapCharge {
  id: string
  status: string
  amount: number
  currency: string
  transaction: { url: string }
  reference: { order: string }
}

export async function createTapCharge(params: TapChargeParams): Promise<TapCharge> {
  const body = {
    amount: params.amount,
    currency: params.currency,
    customer_initiated: true,
    threeDSecure: true,
    save_card: false,
    description: params.description,
    order_id: params.orderId,
    reference: { transaction: params.orderId, order: params.orderId },
    customer: {
      first_name: params.customerName.split(" ")[0] || params.customerName,
      last_name: params.customerName.split(" ").slice(1).join(" ") || "",
      email: params.customerEmail || undefined,
      phone: params.customerPhone
        ? { country_code: "966", number: params.customerPhone.replace(/^\+?966|^0/, "") }
        : undefined,
    },
    source: { id: "src_all" },   // shows all available payment methods
    redirect: { url: params.redirectUrl },
    post: params.webhookUrl ? { url: params.webhookUrl } : undefined,
  }

  const res = await fetch(`${TAP_API}/charges`, {
    method: "POST",
    headers: tapHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.errors?.[0]?.description || `Tap API error ${res.status}`)
  }

  return res.json()
}

export async function getTapCharge(chargeId: string): Promise<TapCharge> {
  const res = await fetch(`${TAP_API}/charges/${chargeId}`, {
    headers: tapHeaders(),
  })
  if (!res.ok) throw new Error(`Tap API error ${res.status}`)
  return res.json()
}

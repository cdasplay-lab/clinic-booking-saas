/**
 * ZATCA Phase 1 QR Code — TLV encoding per Saudi e-invoicing standard
 * Tags:
 *   1 = Seller name
 *   2 = VAT registration number
 *   3 = Invoice timestamp (ISO 8601)
 *   4 = Invoice total (with VAT)
 *   5 = VAT amount
 */

function tlvField(tag: number, value: string): Buffer {
  const valBuf = Buffer.from(value, "utf8")
  const header = Buffer.from([tag, valBuf.length])
  return Buffer.concat([header, valBuf])
}

export function buildZatcaTlv(params: {
  sellerName: string
  vatNumber: string
  invoiceDate: Date
  invoiceTotal: number
  vatAmount: number
}): string {
  const timestamp = params.invoiceDate.toISOString().replace(/\.\d+Z$/, "Z")
  const totalStr = params.invoiceTotal.toFixed(2)
  const vatStr = params.vatAmount.toFixed(2)

  const tlv = Buffer.concat([
    tlvField(1, params.sellerName),
    tlvField(2, params.vatNumber),
    tlvField(3, timestamp),
    tlvField(4, totalStr),
    tlvField(5, vatStr),
  ])

  return tlv.toString("base64")
}

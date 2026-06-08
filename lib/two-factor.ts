import { generateSecret, generateURI, verifySync } from "otplib"
import QRCode from "qrcode"

const APP_NAME = "HesabPro"

export function generateTotpSecret(): string {
  return generateSecret()
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    // Allow ±1 time step (30s) of clock drift, matching the previous window: 1
    const result = verifySync({ token, secret, epochTolerance: 30 })
    return result.valid
  } catch {
    return false
  }
}

export async function generateQrDataUrl(email: string, secret: string): Promise<string> {
  const otpAuthUrl = getOtpAuthUrl(email, secret)
  return QRCode.toDataURL(otpAuthUrl, { width: 200, margin: 1 })
}

export function getOtpAuthUrl(email: string, secret: string): string {
  return generateURI({ issuer: APP_NAME, label: email, secret })
}

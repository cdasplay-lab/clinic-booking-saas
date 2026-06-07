import { authenticator } from "otplib"
import QRCode from "qrcode"

const APP_NAME = "HesabPro"

// Configure TOTP — 30s window, 6 digits (standard)
authenticator.options = { window: 1 }

export function generateTotpSecret(): string {
  return authenticator.generateSecret()
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret })
  } catch {
    return false
  }
}

export async function generateQrDataUrl(email: string, secret: string): Promise<string> {
  const otpAuthUrl = authenticator.keyuri(email, APP_NAME, secret)
  return QRCode.toDataURL(otpAuthUrl, { width: 200, margin: 1 })
}

export function getOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, APP_NAME, secret)
}

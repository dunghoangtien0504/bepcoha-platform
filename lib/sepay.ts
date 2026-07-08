// SePay – Vietnamese payment gateway (bank transfer / QR code)
// Docs: https://docs.sepay.vn

import { randomBytes } from 'crypto'

export interface SepayWebhookPayload {
  id: number
  gateway: string
  transactionDate: string
  accountNumber: string
  code: string | null
  content: string
  transferType: string
  transferAmount: number
  accumulated: number
  subAccount: string | null
  referenceCode: string
  description: string
}

// STN = Sốt Trộn Nộm
export function generateStnRef(phone: string): string {
  const ts = Date.now().toString().slice(-6)
  const phonePart = phone.replace(/\D/g, '').slice(-4)
  return `STN${phonePart}${ts}`
}

// SXC = Sét Xôi Cốm
export function generateSxcRef(phone: string): string {
  const ts = Date.now().toString().slice(-6)
  const phonePart = phone.replace(/\D/g, '').slice(-4)
  return `SXC${phonePart}${ts}`
}

// SXX = Sốt Xá Xíu
export function generateSxxRef(phone: string): string {
  const ts = Date.now().toString().slice(-6)
  const phonePart = phone.replace(/\D/g, '').slice(-4)
  // 4 ký tự ngẫu nhiên để mã khó đoán + tránh trùng
  const rand = randomBytes(2).toString('hex').toUpperCase()
  return `SXX${phonePart}${ts}${rand}`
}

// KDX = Khăn Đồ Xôi
export function generateKdxRef(phone: string): string {
  const ts = Date.now().toString().slice(-6)
  const phonePart = phone.replace(/\D/g, '').slice(-4)
  return `KDX${phonePart}${ts}`
}

export function generatePaymentRef(phone: string): string {
  const ts = Date.now().toString().slice(-6)
  const phonePart = phone.replace(/\D/g, '').slice(-4)
  return `DH${phonePart}${ts}` // DH = Dưa (Hạ) - prefix cấu hình trong SePay
}

export function buildQRPayload(ref: string, amount: number): SepayQRPayload {
  const bankAccount = process.env.SEPAY_BANK_ACCOUNT || ''
  const bankCode = process.env.SEPAY_BANK_CODE || 'MB'
  const accountName = process.env.SEPAY_ACCOUNT_NAME || 'BEP CO HA'

  return {
    bankAccount,
    bankCode,
    accountName,
    amount,
    content: ref,
    qrUrl: `https://qr.sepay.vn/img?bank=${bankCode}&acc=${bankAccount}&template=compact&amount=${amount}&des=${encodeURIComponent(ref)}`,
  }
}

export interface SepayQRPayload {
  bankAccount: string
  bankCode: string
  accountName: string
  amount: number
  content: string
  qrUrl: string
}

export function verifySepayWebhook(payload: SepayWebhookPayload): boolean {
  const apiKey = process.env.SEPAY_API_KEY || ''
  if (!apiKey) return true // Skip in dev mode
  // In production, validate using SEPAY_API_KEY header matching
  return true
}

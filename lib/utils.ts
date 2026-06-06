import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currency = 'SAR', locale = 'ar-SA') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: Date | string, locale = 'ar-SA') {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateShort(date: Date | string) {
  return new Intl.DateTimeFormat('en-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}

export function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .trim()
}

export function calculateDueDate(date: Date, terms: number) {
  const due = new Date(date)
  due.setDate(due.getDate() + terms)
  return due
}

export function getAccountNature(type: string) {
  const debitTypes = ['ASSET', 'EXPENSE', 'BANK', 'CASH', 'ACCOUNTS_RECEIVABLE', 'STOCK', 'FIXED_ASSET']
  return debitTypes.includes(type) ? 'DEBIT' : 'CREDIT'
}

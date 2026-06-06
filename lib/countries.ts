export type CountryCode =
  | "IQ" | "SA" | "AE" | "KW" | "BH" | "QA" | "OM" | "JO" | "EG" | "LY" | "SY" | "YE"

export interface CountryConfig {
  code: CountryCode
  name: string
  nameAr: string
  flag: string
  currency: string
  currencyAr: string
  currencySymbol: string
  vatRate: number        // 0 means no VAT
  vatName: string        // Arabic name shown on invoice
  vatEnabled: boolean
  zatcaRequired: boolean // Saudi e-invoicing
  ftaRequired: boolean   // UAE e-invoicing
  locale: string
  phonePrefix: string
  fiscalYearStart: number // 1=Jan, 4=Apr (UK style)
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  IQ: {
    code: "IQ",
    name: "Iraq",
    nameAr: "العراق",
    flag: "🇮🇶",
    currency: "IQD",
    currencyAr: "دينار عراقي",
    currencySymbol: "د.ع",
    vatRate: 0,
    vatName: "",
    vatEnabled: false,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-IQ",
    phonePrefix: "+964",
    fiscalYearStart: 1,
  },
  SA: {
    code: "SA",
    name: "Saudi Arabia",
    nameAr: "السعودية",
    flag: "🇸🇦",
    currency: "SAR",
    currencyAr: "ريال سعودي",
    currencySymbol: "ر.س",
    vatRate: 15,
    vatName: "ضريبة القيمة المضافة 15%",
    vatEnabled: true,
    zatcaRequired: true,
    ftaRequired: false,
    locale: "ar-SA",
    phonePrefix: "+966",
    fiscalYearStart: 1,
  },
  AE: {
    code: "AE",
    name: "UAE",
    nameAr: "الإمارات",
    flag: "🇦🇪",
    currency: "AED",
    currencyAr: "درهم إماراتي",
    currencySymbol: "د.إ",
    vatRate: 5,
    vatName: "ضريبة القيمة المضافة 5%",
    vatEnabled: true,
    zatcaRequired: false,
    ftaRequired: true,
    locale: "ar-AE",
    phonePrefix: "+971",
    fiscalYearStart: 1,
  },
  KW: {
    code: "KW",
    name: "Kuwait",
    nameAr: "الكويت",
    flag: "🇰🇼",
    currency: "KWD",
    currencyAr: "دينار كويتي",
    currencySymbol: "د.ك",
    vatRate: 0,
    vatName: "",
    vatEnabled: false,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-KW",
    phonePrefix: "+965",
    fiscalYearStart: 1,
  },
  BH: {
    code: "BH",
    name: "Bahrain",
    nameAr: "البحرين",
    flag: "🇧🇭",
    currency: "BHD",
    currencyAr: "دينار بحريني",
    currencySymbol: "د.ب",
    vatRate: 10,
    vatName: "ضريبة القيمة المضافة 10%",
    vatEnabled: true,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-BH",
    phonePrefix: "+973",
    fiscalYearStart: 1,
  },
  QA: {
    code: "QA",
    name: "Qatar",
    nameAr: "قطر",
    flag: "🇶🇦",
    currency: "QAR",
    currencyAr: "ريال قطري",
    currencySymbol: "ر.ق",
    vatRate: 0,
    vatName: "",
    vatEnabled: false,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-QA",
    phonePrefix: "+974",
    fiscalYearStart: 1,
  },
  OM: {
    code: "OM",
    name: "Oman",
    nameAr: "عُمان",
    flag: "🇴🇲",
    currency: "OMR",
    currencyAr: "ريال عُماني",
    currencySymbol: "ر.ع",
    vatRate: 5,
    vatName: "ضريبة القيمة المضافة 5%",
    vatEnabled: true,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-OM",
    phonePrefix: "+968",
    fiscalYearStart: 1,
  },
  JO: {
    code: "JO",
    name: "Jordan",
    nameAr: "الأردن",
    flag: "🇯🇴",
    currency: "JOD",
    currencyAr: "دينار أردني",
    currencySymbol: "د.أ",
    vatRate: 16,
    vatName: "ضريبة المبيعات 16%",
    vatEnabled: true,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-JO",
    phonePrefix: "+962",
    fiscalYearStart: 1,
  },
  EG: {
    code: "EG",
    name: "Egypt",
    nameAr: "مصر",
    flag: "🇪🇬",
    currency: "EGP",
    currencyAr: "جنيه مصري",
    currencySymbol: "ج.م",
    vatRate: 14,
    vatName: "ضريبة القيمة المضافة 14%",
    vatEnabled: true,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-EG",
    phonePrefix: "+20",
    fiscalYearStart: 7,
  },
  LY: {
    code: "LY",
    name: "Libya",
    nameAr: "ليبيا",
    flag: "🇱🇾",
    currency: "LYD",
    currencyAr: "دينار ليبي",
    currencySymbol: "د.ل",
    vatRate: 0,
    vatName: "",
    vatEnabled: false,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-LY",
    phonePrefix: "+218",
    fiscalYearStart: 1,
  },
  SY: {
    code: "SY",
    name: "Syria",
    nameAr: "سوريا",
    flag: "🇸🇾",
    currency: "SYP",
    currencyAr: "ليرة سورية",
    currencySymbol: "ل.س",
    vatRate: 0,
    vatName: "",
    vatEnabled: false,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-SY",
    phonePrefix: "+963",
    fiscalYearStart: 1,
  },
  YE: {
    code: "YE",
    name: "Yemen",
    nameAr: "اليمن",
    flag: "🇾🇪",
    currency: "YER",
    currencyAr: "ريال يمني",
    currencySymbol: "ر.ي",
    vatRate: 0,
    vatName: "",
    vatEnabled: false,
    zatcaRequired: false,
    ftaRequired: false,
    locale: "ar-YE",
    phonePrefix: "+967",
    fiscalYearStart: 1,
  },
}

export function getCountry(code: string): CountryConfig {
  return COUNTRIES[code as CountryCode] ?? COUNTRIES["SA"]
}

export function formatCurrency(amount: number, countryCode: string): string {
  const country = getCountry(countryCode)
  try {
    return new Intl.NumberFormat(country.locale, {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + " " + country.currencySymbol
  } catch {
    return amount.toFixed(2) + " " + country.currencySymbol
  }
}

export const COUNTRY_LIST = Object.values(COUNTRIES)

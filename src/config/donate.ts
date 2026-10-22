// ช่องทางสนับสนุน — กรอกเฉพาะช่องที่ต้องการ ช่องที่เว้นว่างจะไม่แสดงบนหน้าเว็บ
// Donation channels — fill in only what you use; empty entries are hidden.

export interface DonateConfig {
  /** PromptPay: เบอร์มือถือ 10 หลัก (08xxxxxxxx) หรือเลขบัตรประชาชน / เลขผู้เสียภาษี 13 หลัก */
  promptpay: string
  /** ชื่อบัญชีที่จะขึ้นตอนสแกน ให้คนโอนเช็กได้ว่าถูกคน */
  promptpayName: string
  /** โอนผ่านเลขบัญชี */
  bank: { bank: string; name: string; number: string } | null
  /** ลิงก์ภายนอก เช่น Buy Me a Coffee, Ko-fi, GitHub Sponsors, PayPal */
  links: { label: string; url: string }[]
}

export const DONATE: DonateConfig = {
  promptpay: '',
  promptpayName: '',
  bank: null,
  links: [],
}

export const REPO_URL = 'https://github.com/NTPxz/pacer'

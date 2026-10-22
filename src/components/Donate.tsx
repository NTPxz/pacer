import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import QRCode from 'qrcode'
import { DONATE, REPO_URL } from '../config/donate'
import { isValidPromptPay, promptPayPayload } from '../lib/promptpay'

// amounts named after what an aid station hands out
const CUPS = [
  { amount: 35, label: 'น้ำเปล่า' },
  { amount: 59, label: 'เกลือแร่' },
  { amount: 99, label: 'เจลพลังงาน' },
  { amount: 199, label: 'มื้อหลังแข่ง' },
]

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 1600)
    return () => clearTimeout(t)
  }, [copied])
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
    } catch {
      /* clipboard blocked — the text is still visible to copy by hand */
    }
  }
  return { copied, copy }
}

export function Donate() {
  const hasPromptPay = isValidPromptPay(DONATE.promptpay)
  const hasBank = !!DONATE.bank?.number
  const links = DONATE.links.filter((l) => l.url)
  const anyChannel = hasPromptPay || hasBank || links.length > 0

  return (
    <div className={`donate ${anyChannel ? '' : 'is-empty'}`}>
      {hasPromptPay && <PromptPayCard />}
      {hasBank && <BankCard />}
      <div className="donate-card donate-side">
        {links.length > 0 && (
          <div className="donate-links">
            <span className="donate-kicker">ช่องทางอื่น</span>
            {links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="donate-link">
                <span>{l.label}</span>
                <span aria-hidden>↗</span>
              </a>
            ))}
          </div>
        )}
        {!anyChannel && <p className="donate-soon">ช่องทางโอนกำลังจะมาเร็ว ๆ นี้</p>}
        <div className="donate-free">
          <span className="donate-kicker">ไม่ต้องจ่ายก็ช่วยได้</span>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="donate-link">
            <span>กดดาวให้โปรเจกต์บน GitHub</span>
            <span aria-hidden>★</span>
          </a>
          <a href={`${REPO_URL}/issues/new`} target="_blank" rel="noopener noreferrer" className="donate-link">
            <span>แจ้งบั๊ก / เสนอฟีเจอร์</span>
            <span aria-hidden>↗</span>
          </a>
          <p>หรือแชร์ให้เพื่อนในก๊วนวิ่ง — แค่นี้ก็มีแรงทำต่อแล้ว</p>
        </div>
      </div>
    </div>
  )
}

function PromptPayCard() {
  const [amount, setAmount] = useState<number | null>(CUPS[1].amount)
  const [custom, setCustom] = useState('')
  const [svg, setSvg] = useState('')
  const payload = promptPayPayload(DONATE.promptpay, amount ?? undefined)
  const { copied, copy } = useCopy()

  useEffect(() => {
    let live = true
    QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#161513', light: '#ffffff' } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(''))
    return () => {
      live = false
    }
  }, [payload])

  const saveQr = async () => {
    const url = await QRCode.toDataURL(payload, { width: 900, margin: 2, errorCorrectionLevel: 'M' })
    const a = document.createElement('a')
    a.href = url
    a.download = `tayan-promptpay${amount ? `-${amount}` : ''}.png`
    a.click()
  }

  const digits = DONATE.promptpay.replace(/\D/g, '')
  const masked = digits.length === 10 ? `${digits.slice(0, 3)}-xxx-${digits.slice(6)}` : `${digits.slice(0, 1)}-xxxx-xxxxx-${digits.slice(10)}`

  return (
    <div className="donate-card donate-qr">
      <span className="donate-kicker">สแกนจ่ายด้วยแอปธนาคาร · พร้อมเพย์</span>
      <div className="cups" role="radiogroup" aria-label="จำนวนเงิน">
        {CUPS.map((c) => (
          <button
            key={c.amount}
            type="button"
            role="radio"
            aria-checked={amount === c.amount && !custom}
            className={amount === c.amount && !custom ? 'is-active' : ''}
            onClick={() => {
              setCustom('')
              setAmount(c.amount)
            }}
          >
            <b>{c.amount}</b>
            <small>{c.label}</small>
          </button>
        ))}
        <label className={`cup-custom ${custom ? 'is-active' : ''}`}>
          <input
            inputMode="numeric"
            placeholder="อื่น ๆ"
            value={custom}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6)
              setCustom(v)
              setAmount(v ? Number(v) : null)
            }}
            aria-label="ใส่จำนวนเงินเอง"
          />
          <small>บาท</small>
        </label>
      </div>

      <div className="qr-frame">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={payload}
            className="qr-svg"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            // generated locally by the qrcode library from our own payload
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </AnimatePresence>
        <div className="qr-meta">
          <strong>{amount ? `${amount.toLocaleString()} บาท` : 'ใส่จำนวนเงินเองในแอป'}</strong>
          {DONATE.promptpayName && <span>{DONATE.promptpayName}</span>}
          <span className="mono">{masked}</span>
        </div>
      </div>

      <div className="donate-actions">
        <button type="button" className="ghost" onClick={saveQr}>
          บันทึก QR
        </button>
        <button type="button" className="ghost" onClick={() => copy('pp', digits)}>
          {copied === 'pp' ? 'คัดลอกแล้ว' : 'คัดลอกเลขพร้อมเพย์'}
        </button>
      </div>
      <p className="donate-hint">บนมือถือ: บันทึก QR แล้วเปิดแอปธนาคาร เลือกสแกนจากรูปในเครื่อง</p>
    </div>
  )
}

function BankCard() {
  const bank = DONATE.bank!
  const { copied, copy } = useCopy()
  return (
    <div className="donate-card donate-bank">
      <span className="donate-kicker">โอนผ่านบัญชี</span>
      <strong className="bank-name">{bank.bank}</strong>
      <button type="button" className="bank-number" onClick={() => copy('bank', bank.number.replace(/\D/g, ''))}>
        <span className="mono">{bank.number}</span>
        <small>{copied === 'bank' ? 'คัดลอกแล้ว' : 'แตะเพื่อคัดลอก'}</small>
      </button>
      <span className="bank-holder">{bank.name}</span>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth, type Provider } from '../lib/auth'
import type { SyncStatus } from '../lib/sync'

const STATUS_TEXT: Record<SyncStatus, string> = {
  guest: 'โหมด guest',
  syncing: 'กำลังซิงก์…',
  synced: 'ซิงก์แล้ว',
  offline: 'ออฟไลน์ — จะซิงก์เมื่อกลับมาออนไลน์',
  error: 'ซิงก์ไม่สำเร็จ',
}

/** header control: "เข้าสู่ระบบ" for guests, avatar + menu when signed in */
export function AccountButton() {
  const { enabled, user, status } = useAuth()
  const [sheet, setSheet] = useState(false)
  const [menu, setMenu] = useState(false)
  if (!enabled) return null

  if (!user) {
    return (
      <>
        <button type="button" className="login-btn" onClick={() => setSheet(true)}>
          เข้าสู่ระบบ
        </button>
        {createPortal(<AnimatePresence>{sheet && <LoginSheet onClose={() => setSheet(false)} />}</AnimatePresence>, document.body)}
      </>
    )
  }

  const meta = user.user_metadata ?? {}
  const name: string = meta.full_name || meta.name || user.email || 'นักวิ่ง'
  const avatar: string | undefined = meta.avatar_url || meta.picture
  return (
    <div className="account">
      <button type="button" className="avatar-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="บัญชีของฉัน">
        {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
        <i className="sync-dot" data-status={status} aria-hidden />
      </button>
      <AnimatePresence>{menu && <AccountMenu name={name} onClose={() => setMenu(false)} />}</AnimatePresence>
    </div>
  )
}

function AccountMenu({ name, onClose }: { name: string; onClose: () => void }) {
  const { user, status, signOut, deleteAccount } = useAuth()
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const provider = user?.app_metadata?.provider as string | undefined

  return (
    <motion.div
      ref={ref}
      className="account-menu"
      role="menu"
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.16 }}
    >
      <div className="account-who">
        <strong>{name}</strong>
        <span>
          {provider === 'facebook' ? 'Facebook' : provider === 'google' ? 'Google' : provider} · {STATUS_TEXT[status]}
        </span>
      </div>
      <p className="account-note">ตั้งค่า ตารางซ้อม บันทึกการซ้อม และตู้ถ้วยพร้อมรูป ซิงก์ข้ามเครื่องให้อัตโนมัติ</p>
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await signOut()
          onClose()
        }}
      >
        ออกจากระบบ
      </button>
      <button
        type="button"
        role="menuitem"
        className="danger"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm('ลบบัญชีและข้อมูลทั้งหมดบนคลาวด์ถาวร (รวมรูปในตู้ถ้วย)? ย้อนกลับไม่ได้')) return
          setBusy(true)
          setError('')
          try {
            await deleteAccount()
            onClose()
          } catch (e) {
            setError(`ลบไม่สำเร็จ: ${(e as Error).message}`)
            setBusy(false)
          }
        }}
      >
        ลบบัญชีและข้อมูล
      </button>
      {error && <p className="form-error">{error}</p>}
    </motion.div>
  )
}

function LoginSheet({ onClose }: { onClose: () => void }) {
  const { signIn } = useAuth()
  const [pending, setPending] = useState<Provider | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const go = async (p: Provider) => {
    setPending(p)
    setError('')
    try {
      await signIn(p) // navigates away to the provider
    } catch (e) {
      setError((e as Error).message)
      setPending(null)
    }
  }

  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="sheet login-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        <header className="sheet-head">
          <h3 id="login-title">เก็บข้อมูลไว้บนคลาวด์</h3>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="ปิด">
            ×
          </button>
        </header>
        <ul className="login-perks">
          <li>ตารางซ้อมและบันทึกการซ้อมอยู่ครบ แม้เปลี่ยนมือถือหรือล้างเบราว์เซอร์</li>
          <li>ใช้บัญชีเดียวทั้งมือถือและคอม ซิงก์ให้เอง</li>
          <li>ข้อมูลที่ใช้แบบ guest อยู่ตอนนี้ย้ายเข้าบัญชีให้อัตโนมัติ</li>
        </ul>

        <div className="login-buttons">
          <button type="button" className="oauth google" onClick={() => go('google')} disabled={!!pending}>
            <svg viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            {pending === 'google' ? 'กำลังไปที่ Google…' : 'ดำเนินการต่อด้วย Google'}
          </button>
          <button type="button" className="oauth facebook" onClick={() => go('facebook')} disabled={!!pending}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
            </svg>
            {pending === 'facebook' ? 'กำลังไปที่ Facebook…' : 'ดำเนินการต่อด้วย Facebook'}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}

        <button type="button" className="link guest-link" onClick={onClose}>
          ใช้ต่อแบบ guest — ข้อมูลเก็บในเครื่องนี้เท่านั้น
        </button>
        <p className="login-legal">
          เราใช้แค่ชื่อและรูปโปรไฟล์เพื่อแสดงบัญชี ไม่โพสต์อะไรแทนคุณ ·{' '}
          <a href="./privacy.html" target="_blank" rel="noopener">
            นโยบายความเป็นส่วนตัว
          </a>
        </p>
      </motion.div>
    </motion.div>
  )
}

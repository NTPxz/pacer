import { forwardRef, useRef, useState } from 'react'

interface SegProps {
  value: number
  max: number
  digits: number
  label: string
  onValue: (v: number) => void
  onFull?: () => void
}

const Seg = forwardRef<HTMLInputElement, SegProps>(function Seg(
  { value, max, digits, label, onValue, onFull },
  ref,
) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const shown = focused ? text : String(value).padStart(digits, '0')

  return (
    <label className={`seg ${value === 0 && digits === 1 ? 'is-zero' : ''}`}>
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        value={shown}
        style={{ width: `${digits}ch` }}
        onFocus={(e) => {
          setFocused(true)
          setText(String(value).padStart(digits, '0'))
          requestAnimationFrame(() => e.target.select())
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '').slice(-digits)
          setText(raw)
          const n = Number(raw || 0)
          if (n <= max) onValue(n)
          if (raw.length === digits) onFull?.()
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
          e.preventDefault()
          const step = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)
          const n = Math.min(max, Math.max(0, value + step))
          setText(String(n).padStart(digits, '0'))
          onValue(n)
        }}
      />
      <span className="seg-label">{label}</span>
    </label>
  )
})

export function TimeInput({ seconds, onChange }: { seconds: number; onChange: (s: number) => void }) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mRef = useRef<HTMLInputElement>(null)
  const sRef = useRef<HTMLInputElement>(null)

  return (
    <div className="clock">
      <Seg value={h} max={9} digits={1} label="ชม." onValue={(v) => onChange(v * 3600 + m * 60 + s)} onFull={() => mRef.current?.focus()} />
      <span className="colon">:</span>
      <Seg ref={mRef} value={m} max={59} digits={2} label="นาที" onValue={(v) => onChange(h * 3600 + v * 60 + s)} onFull={() => sRef.current?.focus()} />
      <span className="colon">:</span>
      <Seg ref={sRef} value={s} max={59} digits={2} label="วินาที" onValue={(v) => onChange(h * 3600 + m * 60 + v)} />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { isQuality, type Workout } from '../lib/plan'
import {
  EFFORT_LABEL,
  STATUS_LABEL,
  type DayLog,
  type Effort,
  type Feeling,
  type Status,
} from '../lib/training-log'
import { Battery } from './Battery'

export function DayLogSheet({
  date,
  workout,
  value,
  onSave,
  onDelete,
  onClose,
}: {
  date: Date
  workout: Workout
  value?: DayLog
  onSave: (l: DayLog) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [feeling, setFeeling] = useState<Feeling | undefined>(value?.feeling)
  const [status, setStatus] = useState<Status | undefined>(value?.status)
  const [km, setKm] = useState(value?.km != null ? String(value.km) : '')
  const [effort, setEffort] = useState<Effort | undefined>(value?.effort)
  const [note, setNote] = useState(value?.note ?? '')
  const isRun = workout.km > 0 || (value?.planned?.km ?? 0) > 0
  const planned = value?.planned ?? { kind: workout.kind, title: workout.title, km: workout.km }

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(km.replace(',', '.'))
    onSave({
      feeling,
      status,
      km: status && status !== 'missed' && km !== '' && Number.isFinite(n) ? n : status === 'missed' ? 0 : undefined,
      effort: status && status !== 'missed' ? effort : undefined,
      note: note.trim() || undefined,
      planned,
    })
  }

  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-log-title"
        onSubmit={submit}
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        <header className="sheet-head">
          <div>
            <span className="mono-label">
              {date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
            <h3 id="day-log-title">{planned.title}</h3>
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="ปิด">
            ×
          </button>
        </header>
        <p className="log-planned">{workout.detail}</p>

        <div className="field">
          <span className="field-label">ก่อนวิ่ง แบตเป็นยังไง</span>
          <Battery value={feeling} onChange={setFeeling} />
        </div>

        {isRun && (
          <>
            <div className="field">
              <span className="field-label">ผลการซ้อม</span>
              <div className="chips">
                {(['done', 'partial', 'missed'] as Status[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-status={s}
                    className={status === s ? 'is-active' : ''}
                    onClick={() => {
                      setStatus(s)
                      if (s === 'done' && km === '') setKm(String(planned.km))
                    }}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {status && status !== 'missed' && (
              <>
                <label className="field">
                  <span className="field-label">ระยะที่วิ่งจริง (กม.)</span>
                  <input
                    className="text-input"
                    inputMode="decimal"
                    value={km}
                    placeholder={String(planned.km)}
                    onChange={(e) => setKm(e.target.value.replace(/[^\d.,]/g, ''))}
                  />
                </label>
                <div className="field">
                  <span className="field-label">
                    {isQuality(planned.kind) ? 'เซ็ตนี้รู้สึกยังไงเทียบกับเพซที่ให้' : 'รู้สึกยังไง'}
                  </span>
                  <div className="chips">
                    {(['easy', 'ok', 'hard', 'fail'] as Effort[]).map((x) => (
                      <button
                        key={x}
                        type="button"
                        data-effort={x}
                        className={effort === x ? 'is-active' : ''}
                        onClick={() => setEffort(effort === x ? undefined : x)}
                      >
                        {EFFORT_LABEL[x]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <label className="field">
          <span className="field-label">บันทึก</span>
          <textarea
            className="text-input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="อากาศ ชีพจร อาการเจ็บ สิ่งที่สังเกต…"
          />
        </label>

        <footer className="sheet-foot">
          {value && (
            <button type="button" className="ghost danger-text" onClick={onDelete}>
              ล้างบันทึก
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className="primary">
            บันทึก
          </button>
        </footer>
      </motion.form>
    </motion.div>
  )
}

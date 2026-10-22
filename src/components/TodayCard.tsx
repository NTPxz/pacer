import { AnimatePresence, motion } from 'framer-motion'
import type { Adapted } from '../lib/adapt'
import { PHASE_LABEL, type Week } from '../lib/plan'
import { isoDate, STATUS_LABEL, type DayLog, type Feeling, type TrainingLog } from '../lib/training-log'
import { Battery } from './Battery'

export function TodayCard({
  adapted,
  log,
  now,
  onPatch,
  onOpen,
}: {
  adapted: Adapted
  log: TrainingLog
  now: Date
  onPatch: (iso: string, patch: Partial<DayLog>) => void
  onOpen: (w: number, d: number) => void
}) {
  const { plan, currentWeek, stats, notes } = adapted
  const nowLabel = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })

  if (currentWeek < 0) {
    const days = Math.round((plan[0].start.getTime() - now.getTime()) / 86_400_000)
    return (
      <section className="today is-idle" aria-label="วันนี้">
        <span className="mono-label">วันนี้ · {nowLabel}</span>
        <h3>
          ตารางเริ่มอีก <b>{days}</b> วัน
        </h3>
        <p>
          สัปดาห์แรกเริ่ม{' '}
          {plan[0].start.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' })} — ระหว่างนี้วิ่งเบา ๆ
          ตามสบาย เมื่อถึงวันซ้อมจะมีการ์ดนี้ให้เช็กอินและบันทึกผลทุกวัน
        </p>
      </section>
    )
  }
  if (currentWeek >= plan.length) {
    return (
      <section className="today is-idle" aria-label="วันนี้">
        <span className="mono-label">วันนี้ · {nowLabel}</span>
        <h3>จบตารางแล้ว</h3>
        <p>
          ซ้อมไป {stats.done + stats.partial}/{stats.runDays} ครั้ง รวม {Math.round(stats.kmDone)} กม. — อย่าลืมบันทึกผลแข่งในตู้ถ้วยด้านล่าง
        </p>
      </section>
    )
  }

  const week: Week = plan[currentWeek]
  const di = Math.round((now.getTime() - week.start.getTime()) / 86_400_000)
  const w = week.days[di]
  const iso = isoDate(now)
  const l = log[iso]
  const isRun = w.km > 0 || (l?.planned?.km ?? 0) > 0
  const snapshot = { planned: l?.planned ?? { kind: w.kind, title: w.title, km: w.km } }
  const tomorrow = currentWeek < plan.length && di < 6 ? week.days[di + 1] : plan[currentWeek + 1]?.days[0]
  const consistency = stats.runDays ? Math.round(((stats.done + stats.partial * 0.5) / stats.runDays) * 100) : null

  const setFeeling = (f: Feeling) => onPatch(iso, { feeling: f, ...snapshot })

  return (
    <section className="today" aria-label="วันนี้">
      <header className="today-head">
        <span className="mono-label">
          วันนี้ · {nowLabel} · สัปดาห์ {week.n} {PHASE_LABEL[week.phase]}
        </span>
        <div className="today-stats">
          <span>
            ความสม่ำเสมอ <b>{consistency == null ? '—' : `${consistency}%`}</b>
          </span>
          <span>
            วิ่งแล้ว <b>{Math.round(stats.kmDone)}</b>/{Math.round(stats.kmPlanned)} กม.
          </span>
          <span>
            ต่อเนื่อง <b>{stats.streak}</b> ครั้ง
          </span>
        </div>
      </header>

      <div className="today-body">
        <div className="today-workout" data-kind={w.kind}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={w.title + w.km}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <div className="today-title">
                <h3>{w.title}</h3>
                {w.km > 0 && (
                  <span className="today-km">
                    {w.km}
                    <small>กม.</small>
                  </span>
                )}
              </div>
              {w.adapted && <p className="adapted-tag">ปรับแล้ว · {w.adapted}</p>}
              <p className="today-detail">{w.detail}</p>
            </motion.div>
          </AnimatePresence>
          {tomorrow && (
            <p className="today-next">
              พรุ่งนี้: {tomorrow.title}
              {tomorrow.km ? ` ${tomorrow.km} กม.` : ''}
            </p>
          )}
        </div>

        <div className="today-log">
          <div className="field">
            <span className="field-label">ก่อนวิ่ง แบตวันนี้เป็นยังไง</span>
            <Battery value={l?.feeling} onChange={setFeeling} />
            <span className="field-hint">
              {l?.feeling == null
                ? 'เลือกก่อนออกไปวิ่ง ถ้าล้าตารางวันนี้จะเบาลงให้'
                : l.feeling <= 2
                  ? 'ปรับการซ้อมวันนี้ให้เบาลงแล้ว'
                  : l.feeling >= 4
                    ? 'ฟอร์มดี ทำตามแผน แต่อย่าเร่งเกินเพซที่ให้'
                    : 'ทำตามแผนได้เลย'}
            </span>
          </div>

          {isRun && (
            <div className="field">
              <span className="field-label">หลังวิ่ง</span>
              <div className="today-actions">
                {(['done', 'partial', 'missed'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-status={s}
                    className={l?.status === s ? 'is-active' : ''}
                    onClick={() => {
                      if (s === 'done') onPatch(iso, { status: s, km: l?.km ?? w.km, ...snapshot })
                      else if (s === 'missed') onPatch(iso, { status: s, km: 0, effort: undefined, ...snapshot })
                      else onOpen(currentWeek, di)
                    }}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <button type="button" className="link" onClick={() => onOpen(currentWeek, di)}>
                {l?.status ? 'แก้ไข / ใส่ความรู้สึกและโน้ต' : 'บันทึกแบบละเอียด'}
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {notes.length > 0 && (
          <motion.ul
            className="adjustments"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {notes.map((n, i) => (
              <motion.li
                key={n.text}
                data-tone={n.tone}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <span className="mono-label">สัปดาห์ {n.week}</span>
                {n.text}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <p className="today-past-hint">
        ลืมบันทึกวันก่อน ๆ? แตะที่วันนั้นในการ์ดสัปดาห์ด้านล่างได้เลย
      </p>
    </section>
  )
}
